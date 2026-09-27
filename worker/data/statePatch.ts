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
      pushDiff(before[index], after[index], [...path, String(index)], operations);
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
