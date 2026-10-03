export type JsonStatePatchOperation =
  | {
      op: "set";
      path: string[];
      value: unknown;
    }
  | {
      op: "remove";
      path: string[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function samePrimitive(left: unknown, right: unknown): boolean {
  return Object.is(left, right);
}

function pushDiff(
  before: unknown,
  after: unknown,
  path: string[],
  operations: JsonStatePatchOperation[],
): void {
  if (samePrimitive(before, after)) return;

  if (Array.isArray(before) && Array.isArray(after)) {
    const sharedLength = Math.min(before.length, after.length);
    for (let index = 0; index < sharedLength; index += 1) {
      pushDiff(
        before[index],
        after[index],
        [...path, String(index)],
        operations,
      );
    }

    for (let index = before.length - 1; index >= after.length; index -= 1) {
      operations.push({ op: "remove", path: [...path, String(index)] });
    }

    for (let index = sharedLength; index < after.length; index += 1) {
      operations.push({
        op: "set",
        path: [...path, String(index)],
        value: after[index],
      });
    }
    return;
  }

  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const beforeHas = Object.prototype.hasOwnProperty.call(before, key);
      const afterHas = Object.prototype.hasOwnProperty.call(after, key);
      const beforeValue = before[key];
      const afterValue = after[key];

      const beforePresent = beforeHas && beforeValue !== undefined;
      const afterPresent = afterHas && afterValue !== undefined;

      if (!afterPresent) {
        if (beforePresent) {
          operations.push({ op: "remove", path: [...path, key] });
        }
        continue;
      }
      if (!beforePresent) {
        operations.push({
          op: "set",
          path: [...path, key],
          value: afterValue,
        });
        continue;
      }
      pushDiff(beforeValue, afterValue, [...path, key], operations);
    }
    return;
  }

  operations.push({ op: "set", path, value: after });
}

export function buildJsonStatePatch(
  before: unknown,
  after: unknown,
): JsonStatePatchOperation[] {
  const operations: JsonStatePatchOperation[] = [];
  pushDiff(before, after, [], operations);
  return operations;
}

export function buildJsonStatePatchWithCollapsedRoot(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  rootKey: string,
): JsonStatePatchOperation[] {
  const beforeHas =
    Object.prototype.hasOwnProperty.call(before, rootKey) &&
    before[rootKey] !== undefined;
  const afterHas =
    Object.prototype.hasOwnProperty.call(after, rootKey) &&
    after[rootKey] !== undefined;
  const beforeValue = before[rootKey];
  const afterValue = after[rootKey];

  if (beforeHas === afterHas && Object.is(beforeValue, afterValue)) {
    return buildJsonStatePatch(before, after);
  }

  const alignedBefore = { ...before };
  if (afterHas) {
    alignedBefore[rootKey] = afterValue;
  } else {
    delete alignedBefore[rootKey];
  }

  const operations = buildJsonStatePatch(alignedBefore, after);
  const rootOperation: JsonStatePatchOperation = afterHas
    ? { op: "set", path: [rootKey], value: afterValue }
    : { op: "remove", path: [rootKey] };

  return [rootOperation, ...operations];
}

function valueAtPath(
  root: Record<string, unknown>,
  path: readonly string[],
): { present: boolean; value: unknown } {
  let current: unknown = root;
  for (const segment of path) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { present: false, value: undefined };
      }
      current = current[index];
      continue;
    }
    if (
      !isRecord(current) ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return { present: false, value: undefined };
    }
    current = current[segment];
  }
  return { present: current !== undefined, value: current };
}

function replacementForPath(
  after: Record<string, unknown>,
  path: string[],
): JsonStatePatchOperation {
  const target = valueAtPath(after, path);
  return target.present
    ? { op: "set", path, value: target.value }
    : { op: "remove", path };
}

function collapsePatchGroupsAtDepth(
  after: Record<string, unknown>,
  operations: readonly JsonStatePatchOperation[],
  depth: number,
  maximumOperations: number,
): JsonStatePatchOperation[] {
  if (operations.length <= maximumOperations) {
    return [...operations];
  }

  const groups = new Map<
    string,
    { prefix: string[]; indices: number[]; replacementBytes: number }
  >();

  operations.forEach((operation, index) => {
    if (operation.path.length < depth) return;
    const prefix = operation.path.slice(0, depth);
    const key = JSON.stringify(prefix);
    const existing = groups.get(key);
    if (existing) {
      existing.indices.push(index);
      return;
    }
    const replacement = replacementForPath(after, prefix);
    groups.set(key, {
      prefix,
      indices: [index],
      replacementBytes: JSON.stringify(replacement).length,
    });
  });

  const candidates = [...groups.values()]
    .filter((group) => group.indices.length > 1)
    .sort((left, right) => {
      const leftSavings = left.indices.length - 1;
      const rightSavings = right.indices.length - 1;
      const leftEfficiency = leftSavings / Math.max(1, left.replacementBytes);
      const rightEfficiency =
        rightSavings / Math.max(1, right.replacementBytes);
      return (
        rightEfficiency - leftEfficiency ||
        rightSavings - leftSavings ||
        left.replacementBytes - right.replacementBytes ||
        JSON.stringify(left.prefix).localeCompare(JSON.stringify(right.prefix))
      );
    });

  const collapsed = new Map<number, JsonStatePatchOperation>();
  const removed = new Set<number>();
  for (const candidate of candidates) {
    const [firstIndex] = candidate.indices;
    if (firstIndex === undefined) continue;
    collapsed.set(firstIndex, replacementForPath(after, candidate.prefix));
    for (const index of candidate.indices.slice(1)) {
      removed.add(index);
    }
  }

  return operations.flatMap((operation, index) => {
    if (removed.has(index)) return [];
    return [collapsed.get(index) ?? operation];
  });
}

export function compactJsonStatePatchForPersistence(
  after: Record<string, unknown>,
  operations: readonly JsonStatePatchOperation[],
  maximumOperations: number,
): JsonStatePatchOperation[] {
  if (operations.length <= maximumOperations) {
    return [...operations];
  }

  const secondLevel = collapsePatchGroupsAtDepth(
    after,
    operations,
    2,
    maximumOperations,
  );
  if (secondLevel.length <= maximumOperations) {
    return secondLevel;
  }

  return collapsePatchGroupsAtDepth(after, secondLevel, 1, maximumOperations);
}

export function applyJsonStatePatch<T>(
  input: T,
  operations: readonly JsonStatePatchOperation[],
): T {
  let result = structuredClone(input) as unknown;

  for (const operation of operations) {
    if (operation.path.length === 0) {
      if (operation.op === "remove") {
        throw new Error("cannot remove JSON state root");
      }
      result = structuredClone(operation.value);
      continue;
    }

    let current = result as Record<string, unknown> | unknown[];
    for (let index = 0; index < operation.path.length - 1; index += 1) {
      const segment = operation.path[index]!;
      const next = Array.isArray(current)
        ? current[Number(segment)]
        : current[segment];
      if (typeof next !== "object" || next === null) {
        throw new Error("invalid JSON state patch path");
      }
      current = next as Record<string, unknown> | unknown[];
    }

    const key = operation.path[operation.path.length - 1]!;
    if (operation.op === "remove") {
      if (Array.isArray(current)) {
        current.splice(Number(key), 1);
      } else {
        delete current[key];
      }
      continue;
    }

    if (Array.isArray(current)) {
      current[Number(key)] = structuredClone(operation.value);
    } else {
      current[key] = structuredClone(operation.value);
    }
  }

  return result as T;
}

export function collapseJsonStatePatchRoot(
  after: Record<string, unknown>,
  operations: readonly JsonStatePatchOperation[],
  rootKey: string,
): JsonStatePatchOperation[] {
  const affected = operations.filter(
    (operation) => operation.path[0] === rootKey,
  );
  if (affected.length === 0) {
    return [...operations];
  }

  const afterHas =
    Object.prototype.hasOwnProperty.call(after, rootKey) &&
    after[rootKey] !== undefined;

  const replacement: JsonStatePatchOperation = afterHas
    ? { op: "set", path: [rootKey], value: after[rootKey] }
    : { op: "remove", path: [rootKey] };

  const firstIndex = operations.findIndex(
    (operation) => operation.path[0] === rootKey,
  );
  if (firstIndex < 0) {
    return [...operations];
  }

  const before = operations
    .slice(0, firstIndex)
    .filter((operation) => operation.path[0] !== rootKey);
  const afterOperations = operations
    .slice(firstIndex)
    .filter((operation) => operation.path[0] !== rootKey);
  return [...before, replacement, ...afterOperations];
}
