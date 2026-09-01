import { describe, expect, it } from "vitest";
import { getPlayerConditionPresentation } from "../../../../src/domain/player/playerCondition";

describe("playerCondition", () => {
  it.each([
    [100, "絶好調", "red", 1.08],
    [85, "絶好調", "red", 1.08],
    [84, "好調", "green", 1.04],
    [65, "好調", "green", 1.04],
    [64, "普通", "yellow", 1],
    [40, "普通", "yellow", 1],
    [39, "不調", "blue", 0.96],
    [20, "不調", "blue", 0.96],
    [19, "絶不調", "purple", 0.92],
    [0, "絶不調", "purple", 0.92],
  ] as const)(
    "maps condition %i to %s",
    (condition, label, colorToken, matchMultiplier) => {
      const result = getPlayerConditionPresentation(condition);
      expect(result.label).toBe(label);
      expect(result.colorToken).toBe(colorToken);
      expect(result.matchMultiplier).toBe(matchMultiplier);
    },
  );

  it("clamps values outside the internal range", () => {
    expect(getPlayerConditionPresentation(999).label).toBe("絶好調");
    expect(getPlayerConditionPresentation(-999).label).toBe("絶不調");
  });
});
