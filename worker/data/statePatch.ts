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

  const before = operations.slice(0, firstIndex).filter(
    (operation) => operation.path[0] !== rootKey,
  );
  const afterOperations = operations.slice(firstIndex).filter(
    (operation) => operation.path[0] !== rootKey,
  );
  return [...before, replacement, ...afterOperations];
}
