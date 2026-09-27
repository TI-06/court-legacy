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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function equalJson(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => equalJson(value, right[index]));
  }

  if (isObject(left) && isObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        equalJson(left[key], right[key]),
    );
  }

  return false;
}

function pushArrayDiff(
  previous: unknown[],
  next: unknown[],
  path: string[],
  operations: JsonStatePatchOperation[],
): void {
  if (previous.length === next.length) {
    for (let index = 0; index < next.length; index += 1) {
      pushDiff(
        previous[index],
        next[index],
        [...path, String(index)],
        operations,
      );
    }
    return;
  }

  const sharedLength = Math.min(previous.length, next.length);
  let prefixMatches = true;
  for (let index = 0; index < sharedLength; index += 1) {
    if (!equalJson(previous[index], next[index])) {
      prefixMatches = false;
      break;
    }
  }

  if (!prefixMatches) {
    operations.push({ op: "set", path, value: next });
    return;
  }

  if (next.length > previous.length) {
    for (let index = previous.length; index < next.length; index += 1) {
      operations.push({
        op: "set",
        path: [...path, String(index)],
        value: next[index],
      });
    }
    return;
  }

  for (let index = previous.length - 1; index >= next.length; index -= 1) {
    operations.push({ op: "remove", path: [...path, String(index)] });
  }
}

function pushObjectDiff(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  path: string[],
  operations: JsonStatePatchOperation[],
): void {
  for (const key of Object.keys(previous)) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      operations.push({ op: "remove", path: [...path, key] });
    }
  }

  for (const [key, value] of Object.entries(next)) {
    const nextPath = [...path, key];
    if (!Object.prototype.hasOwnProperty.call(previous, key)) {
      operations.push({ op: "set", path: nextPath, value });
      continue;
    }
    pushDiff(previous[key], value, nextPath, operations);
  }
}

function pushDiff(
  previous: unknown,
  next: unknown,
  path: string[],
  operations: JsonStatePatchOperation[],
): void {
  if (Object.is(previous, next)) return;

  if (Array.isArray(previous) && Array.isArray(next)) {
    pushArrayDiff(previous, next, path, operations);
    return;
  }

  if (isObject(previous) && isObject(next)) {
    pushObjectDiff(previous, next, path, operations);
    return;
  }

  if (equalJson(previous, next)) return;
  operations.push({ op: "set", path, value: next });
}

export function createJsonStatePatch(
  previous: unknown,
  next: unknown,
): JsonStatePatchOperation[] {
  const operations: JsonStatePatchOperation[] = [];
  pushDiff(previous, next, [], operations);
  return operations;
}

function resolveParent(root: unknown, path: readonly string[]): {
  parent: Record<string, unknown> | unknown[];
  key: string;
} {
  if (path.length === 0) {
    throw new Error("root patch has no parent");
  }

  let current = root;
  for (const segment of path.slice(0, -1)) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw new Error(`invalid array patch path: ${path.join(".")}`);
      }
      current = current[index];
      continue;
    }

    if (isObject(current)) {
      if (!Object.prototype.hasOwnProperty.call(current, segment)) {
        throw new Error(`missing object patch path: ${path.join(".")}`);
      }
      current = current[segment];
      continue;
    }

    throw new Error(`invalid patch parent: ${path.join(".")}`);
  }

  if (!Array.isArray(current) && !isObject(current)) {
    throw new Error(`invalid patch parent: ${path.join(".")}`);
  }

  return { parent: current, key: path[path.length - 1]! };
}

export function applyJsonStatePatch(
  previous: unknown,
  operations: readonly JsonStatePatchOperation[],
): unknown {
  let result = structuredClone(previous);

  for (const operation of operations) {
    if (operation.path.length === 0) {
      if (operation.op === "remove") {
        throw new Error("cannot remove the root state");
      }
      result = structuredClone(operation.value);
      continue;
    }

    const { parent, key } = resolveParent(result, operation.path);
    if (Array.isArray(parent)) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index > parent.length) {
        throw new Error(
          `invalid array patch index: ${operation.path.join(".")}`,
        );
      }

      if (operation.op === "remove") {
        if (index >= parent.length) {
          throw new Error(
            `missing array patch index: ${operation.path.join(".")}`,
          );
        }
        parent.splice(index, 1);
      } else if (index === parent.length) {
        parent.push(structuredClone(operation.value));
      } else {
        parent[index] = structuredClone(operation.value);
      }
      continue;
    }

    if (operation.op === "remove") {
      delete parent[key];
    } else {
      parent[key] = structuredClone(operation.value);
    }
  }

  return result;
}
