import { describe, expect, it } from "vitest";
import { applyLongTermAbilityGrowth } from "../../../../src/domain/training/resolveWeeklyTraining";

describe("applyLongTermAbilityGrowth", () => {
  it("prevents an ordinary player from training a focused ability past the potential ceiling", () => {
    expect(applyLongTermAbilityGrowth(92, 8, 75, "normal")).toBe(93);
    expect(applyLongTermAbilityGrowth(93, 8, 75, "normal")).toBe(93);
  });

  it("keeps ordinary growth unchanged below the high-ability bands", () => {
    expect(applyLongTermAbilityGrowth(70, 4, 75, "normal")).toBe(74);
  });

  it("lets a top generational talent reach 100 only through slow late growth", () => {
    expect(applyLongTermAbilityGrowth(98, 8, 100, "generational")).toBe(99);
    expect(applyLongTermAbilityGrowth(99, 8, 100, "generational")).toBe(100);
  });
});
