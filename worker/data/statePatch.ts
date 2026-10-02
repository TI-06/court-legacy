export type JsonStatePatchOperation =
  | {
      op: "set";
      path: string[];
      value: unknown;
    }
  | {
      op: "merge";
      path: string[];
      value: Record<string, unknown>;
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

function mergePatchAtPath(
  result: unknown,
  path: readonly string[],
  value: Record<string, unknown>,
): unknown {
  if (path.length === 0) {
    if (!isRecord(result)) {
      throw new Error("cannot merge non-object JSON state root");
    }
    return {
      ...result,
      ...structuredClone(value),
    };
  }

  let current = result as Record<string, unknown> | unknown[];
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index]!;
    const next = Array.isArray(current)
      ? current[Number(segment)]
      : current[segment];
    if (typeof next !== "object" || next === null) {
      throw new Error("invalid JSON state patch path");
    }
    current = next as Record<string, unknown> | unknown[];
  }

  const key = path[path.length - 1]!;
  const target = Array.isArray(current) ? current[Number(key)] : current[key];
  if (!isRecord(target)) {
    throw new Error("cannot merge non-object JSON state target");
  }

  const merged = {
    ...target,
    ...structuredClone(value),
  };
  if (Array.isArray(current)) {
    current[Number(key)] = merged;
  } else {
    current[key] = merged;
  }
  return result;
}

export function applyJsonStatePatch<T>(
  input: T,
  operations: readonly JsonStatePatchOperation[],
): T {
  let result = structuredClone(input) as unknown;

  for (const operation of operations) {
    if (operation.op === "merge") {
      result = mergePatchAtPath(result, operation.path, operation.value);
      continue;
    }

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

export function coalesceJsonStatePatchObjectRoots(
  after: Record<string, unknown>,
  operations: readonly JsonStatePatchOperation[],
  rootKeys: readonly string[],
): JsonStatePatchOperation[] {
  let result = [...operations];

  for (const rootKey of rootKeys) {
    const affected = result.filter(
      (operation) => operation.path[0] === rootKey,
    );
    if (affected.length === 0) continue;
    if (affected.some((operation) => operation.path.length < 2)) continue;

    const afterRoot = after[rootKey];
    if (!isRecord(afterRoot)) continue;

    const touchedKeys = [
      ...new Set(
        affected
          .map((operation) => operation.path[1])
          .filter((key): key is string => key !== undefined),
      ),
    ];
    if (touchedKeys.length === 0) continue;

    const mergeValue: Record<string, unknown> = {};
    const removals: JsonStatePatchOperation[] = [];
    for (const key of touchedKeys) {
      const afterHas =
        Object.prototype.hasOwnProperty.call(afterRoot, key) &&
        afterRoot[key] !== undefined;
      if (afterHas) {
        mergeValue[key] = afterRoot[key];
      } else {
        removals.push({ op: "remove", path: [rootKey, key] });
      }
    }

    const firstIndex = result.findIndex(
      (operation) => operation.path[0] === rootKey,
    );
    if (firstIndex < 0) continue;

    const replacement: JsonStatePatchOperation[] = [];
    if (Object.keys(mergeValue).length > 0) {
      replacement.push({
        op: "merge",
        path: [rootKey],
        value: mergeValue,
      });
    }
    replacement.push(...removals);

    const beforeOperations = result
      .slice(0, firstIndex)
      .filter((operation) => operation.path[0] !== rootKey);
    const afterOperations = result
      .slice(firstIndex)
      .filter((operation) => operation.path[0] !== rootKey);
    result = [...beforeOperations, ...replacement, ...afterOperations];
  }

  return result;
}

function pathStartsWith(
  operationPath: readonly string[],
  prefix: readonly string[],
): boolean {
  return prefix.every((segment, index) => operationPath[index] === segment);
}

function valueAtPath(
  input: Record<string, unknown>,
  path: readonly string[],
): { present: boolean; value: unknown } {
  let current: unknown = input;
  for (const segment of path) {
    if (!isRecord(current) && !Array.isArray(current)) {
      return { present: false, value: undefined };
    }
    const next = Array.isArray(current)
      ? current[Number(segment)]
      : current[segment];
    if (next === undefined) {
      return { present: false, value: undefined };
    }
    current = next;
  }
  return { present: true, value: current };
}

export function collapseNoisyJsonStatePatchPaths(
  after: Record<string, unknown>,
  operations: readonly JsonStatePatchOperation[],
  paths: readonly (readonly string[])[],
  operationThreshold = 4,
): JsonStatePatchOperation[] {
  let result = [...operations];

  for (const path of paths) {
    const affected = result.filter((operation) =>
      pathStartsWith(operation.path, path),
    );
    if (affected.length <= operationThreshold) continue;

    const firstIndex = result.findIndex((operation) =>
      pathStartsWith(operation.path, path),
    );
    if (firstIndex < 0) continue;

    const target = valueAtPath(after, path);
    const replacement: JsonStatePatchOperation = target.present
      ? { op: "set", path: [...path], value: target.value }
      : { op: "remove", path: [...path] };

    const beforeOperations = result
      .slice(0, firstIndex)
      .filter((operation) => !pathStartsWith(operation.path, path));
    const afterOperations = result
      .slice(firstIndex)
      .filter((operation) => !pathStartsWith(operation.path, path));
    result = [...beforeOperations, replacement, ...afterOperations];
  }

  return result;
}
