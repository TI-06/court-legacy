export interface RandomSnapshot {
  seed: string;
  cursor: number;
}

export interface RandomSource {
  readonly cursor: number;
  next(): number;
  int(minimum: number, maximum: number): number;
  pick<T>(items: readonly T[]): T;
  fork(label: string): RandomSource;
  snapshot(): RandomSnapshot;
}

const UINT32_RANGE = 4_294_967_296;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const GOLDEN_RATIO = 0x9e3779b9;

function hashSeed(seed: string): number {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), FNV_PRIME);
  }

  return hash >>> 0;
}

function mix32(input: number): number {
  let value = input;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}

export class SeededRandom implements RandomSource {
  readonly #seed: string;
  readonly #seedHash: number;
  #cursor: number;

  constructor(seed: string, cursor = 0) {
    if (seed.length === 0) {
      throw new Error("seed must not be empty");
    }

    if (!Number.isSafeInteger(cursor) || cursor < 0) {
      throw new Error("cursor must be a non-negative safe integer");
    }

    this.#seed = seed;
    this.#seedHash = hashSeed(seed);
    this.#cursor = cursor;
  }

  get cursor(): number {
    return this.#cursor;
  }

  next(): number {
    const counter = Math.imul(this.#cursor + 1, GOLDEN_RATIO);
    const value = mix32(this.#seedHash + counter);
    this.#cursor += 1;
    return value / UINT32_RANGE;
  }

  int(minimum: number, maximum: number): number {
    if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)) {
      throw new Error("integer boundaries must be safe integers");
    }

    if (minimum > maximum) {
      throw new Error("minimum must not exceed maximum");
    }

    const width = maximum - minimum + 1;
    if (!Number.isSafeInteger(width) || width <= 0) {
      throw new Error("integer range is too large");
    }

    return minimum + Math.floor(this.next() * width);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("cannot pick from an empty collection");
    }

    return items[this.int(0, items.length - 1)] as T;
  }

  fork(label: string): SeededRandom {
    if (label.length === 0) {
      throw new Error("fork label must not be empty");
    }

    return new SeededRandom(`${this.#seed}::${label}`);
  }

  snapshot(): RandomSnapshot {
    return {
      seed: this.#seed,
      cursor: this.#cursor,
    };
  }
}
