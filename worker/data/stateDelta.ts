export interface JsonStateDelta {
  set: Record<string, unknown>;
  merge: Record<string, Record<string, unknown>>;
  remove: string[];
  removeKeys: Record<string, string[]>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right) return false;
  if (left === null || right === null) return false;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!jsonEqual(left[index], right[index])) return false;
    }
    return true;
  }

  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
      if (!jsonEqual(left[key], right[key])) return false;
    }
    return true;
  }

  return false;
}

export function buildJsonStateDelta(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): JsonStateDelta {
  const delta: JsonStateDelta = {
    set: {},
    merge: {},
    remove: [],
    removeKeys: {},
  };

  const roots = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const root of roots) {
    const beforeHas =
      Object.prototype.hasOwnProperty.call(before, root) &&
      before[root] !== undefined;
    const afterHas =
      Object.prototype.hasOwnProperty.call(after, root) &&
      after[root] !== undefined;

    if (!afterHas) {
      if (beforeHas) delta.remove.push(root);
      continue;
    }
    if (!beforeHas) {
      delta.set[root] = after[root];
      continue;
    }

    const beforeValue = before[root];
    const afterValue = after[root];
    if (Object.is(beforeValue, afterValue)) {
      continue;
    }

    if (!isRecord(beforeValue) || !isRecord(afterValue)) {
      if (!jsonEqual(beforeValue, afterValue)) {
        delta.set[root] = afterValue;
      }
      continue;
    }

    const changed: Record<string, unknown> = {};
    const removed: string[] = [];
    const childKeys = new Set([
      ...Object.keys(beforeValue),
      ...Object.keys(afterValue),
    ]);
    for (const childKey of childKeys) {
      const beforeChildHas =
        Object.prototype.hasOwnProperty.call(beforeValue, childKey) &&
        beforeValue[childKey] !== undefined;
      const afterChildHas =
        Object.prototype.hasOwnProperty.call(afterValue, childKey) &&
        afterValue[childKey] !== undefined;

      if (!afterChildHas) {
        if (beforeChildHas) removed.push(childKey);
        continue;
      }
      if (
        !beforeChildHas ||
        !jsonEqual(beforeValue[childKey], afterValue[childKey])
      ) {
        changed[childKey] = afterValue[childKey];
      }
    }

    if (Object.keys(changed).length > 0) {
      delta.merge[root] = changed;
    }
    if (removed.length > 0) {
      delta.removeKeys[root] = removed;
    }
  }

  return delta;
}

export function applyJsonStateDelta<T extends Record<string, unknown>>(
  input: T,
  delta: JsonStateDelta,
): T {
  const result = structuredClone(input) as Record<string, unknown>;

  for (const root of delta.remove) {
    delete result[root];
  }
  for (const [root, value] of Object.entries(delta.set)) {
    result[root] = structuredClone(value);
  }

  const mergeRoots = new Set([
    ...Object.keys(delta.merge),
    ...Object.keys(delta.removeKeys),
  ]);
  for (const root of mergeRoots) {
    const current = result[root];
    if (!isRecord(current)) {
      throw new Error(`state delta merge root is not an object: ${root}`);
    }
    const next = { ...current };
    for (const childKey of delta.removeKeys[root] ?? []) {
      delete next[childKey];
    }
    for (const [childKey, value] of Object.entries(delta.merge[root] ?? {})) {
      next[childKey] = structuredClone(value);
    }
    result[root] = next;
  }

  return result as T;
}
