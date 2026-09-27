export type JsonStatePatchOperation =
  | { op: "set"; path: string[]; value: unknown }
  | { op: "remove"; path: string[] }
  | { op: "append"; path: string[]; value: unknown[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => jsonEqual(value, right[index]));
  }

  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined);
    const rightKeys = Object.keys(right).filter(
      (key) => right[key] !== undefined,
    );
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        jsonEqual(left[key], right[key]),
    );
  }

  return false;
}

function appendOnlyDelta(
  before: readonly unknown[],
  after: readonly unknown[],
): unknown[] | null {
  if (after.length <= before.length) return null;
  for (let index = 0; index < before.length; index += 1) {
    if (!jsonEqual(before[index], after[index])) return null;
  }
  return after.slice(before.length);
}

function buildPatch(
  before: unknown,
  after: unknown,
  path: string[],
  operations: JsonStatePatchOperation[],
): void {
  if (Object.is(before, after)) return;

  if (Array.isArray(before) && Array.isArray(after)) {
    if (jsonEqual(before, after)) return;
    const appended = appendOnlyDelta(before, after);
    if (appended) {
      operations.push({ op: "append", path, value: appended });
      return;
    }
    operations.push({ op: "set", path, value: after });
    return;
  }

  if (isRecord(before) && isRecord(after)) {
    for (const key of Object.keys(before)) {
      const afterHasKey =
        Object.prototype.hasOwnProperty.call(after, key) &&
        after[key] !== undefined;
      if (before[key] !== undefined && !afterHasKey) {
        operations.push({ op: "remove", path: [...path, key] });
      }
    }

    for (const key of Object.keys(after)) {
      const afterValue = after[key];
      if (afterValue === undefined) continue;
      const beforeHasKey =
        Object.prototype.hasOwnProperty.call(before, key) &&
        before[key] !== undefined;
      if (!beforeHasKey) {
        operations.push({
          op: "set",
          path: [...path, key],
          value: afterValue,
        });
        continue;
      }
      buildPatch(before[key], afterValue, [...path, key], operations);
    }
    return;
  }

  operations.push({ op: "set", path, value: after });
}

export function buildJsonStatePatchOperations(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): JsonStatePatchOperation[] {
  const operations: JsonStatePatchOperation[] = [];
  buildPatch(before, after, [], operations);
  if (operations.some((operation) => operation.path.length === 0)) {
    throw new Error("root state replacement is not supported");
  }
  return operations;
}
