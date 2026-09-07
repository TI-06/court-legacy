import { describe, expect, it } from "vitest";
import { ratingToGrade } from "../../../../src/features/match/teamRatingGrade";

describe("ratingToGrade", () => {
  it.each([
    [100, "A"],
    [80, "A"],
    [79, "B"],
    [70, "B"],
    [69, "C"],
    [60, "C"],
    [59, "D"],
    [50, "D"],
    [49, "E"],
    [40, "E"],
    [39, "F"],
    [20, "F"],
    [19, "G"],
    [0, "G"],
  ])("maps %s to %s", (value, expected) => {
    expect(ratingToGrade(value)).toBe(expected);
  });
});
