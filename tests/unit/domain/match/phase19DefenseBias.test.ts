import { describe, expect, it } from "vitest";
import {
  getDefenseDirectionAdjustment,
  type AttackDirection,
} from "../../../../src/domain/match/simulateMatch";

function adjustment(
  defense: "line" | "balanced" | "cross",
  direction: AttackDirection,
) {
  return getDefenseDirectionAdjustment(defense, direction);
}

describe("Phase19-4 directional defense", () => {
  it("rewards a correct directional read and penalizes the wrong read symmetrically", () => {
    expect(adjustment("line", "line")).toBe(3);
    expect(adjustment("line", "cross")).toBe(-3);
    expect(adjustment("cross", "cross")).toBe(3);
    expect(adjustment("cross", "line")).toBe(-3);
  });

  it("keeps balanced coverage stable and neutral attacks unbiased", () => {
    expect(adjustment("balanced", "line")).toBe(0);
    expect(adjustment("balanced", "cross")).toBe(0);
    expect(adjustment("line", "neutral")).toBe(0);
    expect(adjustment("cross", "neutral")).toBe(0);
  });

  it("keeps the complete directional swing bounded", () => {
    const correct = adjustment("line", "line");
    const wrong = adjustment("cross", "line");
    expect(correct - wrong).toBeLessThanOrEqual(8);
  });
});
