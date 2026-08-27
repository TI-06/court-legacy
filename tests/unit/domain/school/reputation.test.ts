import { describe, expect, test } from "vitest";
import {
  reputationGrade,
  resolveSeasonReputation,
} from "../../../../src/domain/school/reputation";

describe("reputationGrade", () => {
  test.each([
    [0, "E"],
    [199, "E"],
    [200, "D"],
    [400, "C"],
    [600, "B"],
    [800, "A"],
    [1000, "S"],
    [1200, "SS"],
    [1400, "SS"],
  ] as const)("maps %s points to %s", (points, grade) => {
    expect(reputationGrade(points)).toBe(grade);
  });
});

describe("resolveSeasonReputation", () => {
  test("rewards strong results without making one season erase long-term prestige", () => {
    const result = resolveSeasonReputation({
      currentPoints: 760,
      recentSeasonRatings: [72, 75, 79],
      officialWins: 18,
      officialLosses: 4,
      prefecturalTitles: 1,
      nationalAppearances: 1,
      nationalTitles: 0,
    });

    expect(result.points).toBeGreaterThan(760);
    expect(result.points).toBeLessThanOrEqual(1400);
    expect(result.recentSeasonRatings).toHaveLength(4);
    expect(result.seasonRating).toBeGreaterThanOrEqual(0);
    expect(result.seasonRating).toBeLessThanOrEqual(100);
  });

  test("keeps recent ratings to a five-season window and clamps points", () => {
    const result = resolveSeasonReputation({
      currentPoints: 1395,
      recentSeasonRatings: [90, 91, 92, 93, 94],
      officialWins: 100,
      officialLosses: 0,
      prefecturalTitles: 10,
      nationalAppearances: 10,
      nationalTitles: 10,
    });

    expect(result.points).toBeLessThanOrEqual(1400);
    expect(result.recentSeasonRatings).toHaveLength(5);
    expect(result.recentSeasonRatings.at(-1)).toBe(result.seasonRating);
  });
});
