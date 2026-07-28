import { SeededRandom } from "../../../src/domain/random/SeededRandom";
import { weightedChoice } from "../../../src/domain/random/weightedChoice";

describe("SeededRandom", () => {
  it("reproduces the same sequence from the same seed", () => {
    const first = new SeededRandom("court-legacy");
    const second = new SeededRandom("court-legacy");

    expect(Array.from({ length: 5 }, () => first.next())).toEqual(
      Array.from({ length: 5 }, () => second.next()),
    );
  });

  it("keeps the published sequence stable", () => {
    const random = new SeededRandom("court-legacy");

    expect(Array.from({ length: 5 }, () => random.next())).toEqual([
      0.8712830147705972,
      0.8011873930227011,
      0.5212099316995591,
      0.5974441117141396,
      0.4619873077608645,
    ]);
  });

  it("resumes from a saved cursor", () => {
    const original = new SeededRandom("season-12");
    original.next();
    original.next();
    const snapshot = original.snapshot();

    const restored = new SeededRandom(snapshot.seed, snapshot.cursor);

    expect(restored.next()).toBe(original.next());
    expect(restored.cursor).toBe(3);
  });

  it("produces distinct streams for different seeds and forks", () => {
    const first = new SeededRandom("school-a");
    const second = new SeededRandom("school-b");
    const playerFork = first.fork("players");
    const matchFork = first.fork("matches");

    expect(first.next()).not.toBe(second.next());
    expect(playerFork.next()).not.toBe(matchFork.next());
    expect(first.cursor).toBe(1);
  });

  it("returns inclusive integers and validates ranges", () => {
    const random = new SeededRandom("integer-test");
    const values = Array.from({ length: 100 }, () => random.int(2, 4));

    expect(values.every((value) => value >= 2 && value <= 4)).toBe(true);
    expect(new Set(values)).toEqual(new Set([2, 3, 4]));
    expect(() => random.int(4, 2)).toThrow("minimum must not exceed maximum");
    expect(() => random.int(1.5, 2)).toThrow("integer boundaries");
  });

  it("selects array items and rejects an empty array", () => {
    const random = new SeededRandom("pick-test");

    expect(["OH", "MB", "S"]).toContain(random.pick(["OH", "MB", "S"]));
    expect(() => random.pick([])).toThrow("cannot pick from an empty collection");
  });
});

describe("weightedChoice", () => {
  it("returns null when no item has positive weight", () => {
    const random = new SeededRandom("weights-none");

    expect(
      weightedChoice(
        [
          { value: "A", weight: 0 },
          { value: "B", weight: 0 },
        ],
        random,
      ),
    ).toBeNull();
  });

  it("never selects a zero-weight entry", () => {
    const random = new SeededRandom("weights-zero");
    const results = Array.from({ length: 50 }, () =>
      weightedChoice(
        [
          { value: "never", weight: 0 },
          { value: "always", weight: 1 },
        ],
        random,
      ),
    );

    expect(new Set(results)).toEqual(new Set(["always"]));
  });

  it("rejects negative and non-finite weights", () => {
    const random = new SeededRandom("weights-invalid");

    expect(() =>
      weightedChoice([{ value: "A", weight: -1 }], random),
    ).toThrow("non-negative finite number");
    expect(() =>
      weightedChoice([{ value: "A", weight: Number.POSITIVE_INFINITY }], random),
    ).toThrow("non-negative finite number");
  });
});
