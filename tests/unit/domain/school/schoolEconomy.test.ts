import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  alumniAnnualBudgetBonus,
  annualSchoolBudget,
  applySchoolFundsChange,
} from "../../../../src/domain/school/schoolEconomy";

describe("school economy", () => {
  it("maps reputation to the approved annual budgets", () => {
    expect(annualSchoolBudget("unknown")).toBe(400);
    expect(annualSchoolBudget("district-contender")).toBe(500);
    expect(annualSchoolBudget("prefectural-power")).toBe(650);
    expect(annualSchoolBudget("national-qualifier")).toBe(850);
    expect(annualSchoolBudget("national-regular")).toBe(1100);
    expect(annualSchoolBudget("elite")).toBe(1400);
  });

  it("calculates the deterministic alumni budget contribution", () => {
    expect(alumniAnnualBudgetBonus(0)).toBe(0);
    expect(alumniAnnualBudgetBonus(5)).toBe(40);
    expect(alumniAnnualBudgetBonus(20)).toBe(260);
    expect(alumniAnnualBudgetBonus(50)).toBe(800);
  });

  it("rejects an unaffordable debit instead of creating debt", () => {
    const state = createDemoGame();
    expect(() =>
      applySchoolFundsChange(state, {
        id: "test:overspend",
        kind: "facility-upgrade",
        amount: -99999,
        label: "overspend",
      }),
    ).toThrow("insufficient school funds");
  });
});
