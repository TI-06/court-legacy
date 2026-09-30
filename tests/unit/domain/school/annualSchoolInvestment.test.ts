import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import {
  activeAnnualInvestments,
  annualInvestmentEffects,
  evaluateAnnualInvestmentUpgrade,
  upgradeAnnualInvestment,
} from "../../../src/domain/school/annualSchoolInvestment";

describe("annual school investments", () => {
  it("spends school funds and raises one area up to level three", () => {
    let state = createDemoGame();
    const schoolId = state.userSchoolId;
    const before = state.schools[schoolId]!.funds;

    state = upgradeAnnualInvestment(state, "development");
    expect(activeAnnualInvestments(state).levels.development).toBe(1);
    expect(state.schools[schoolId]!.funds).toBe(before - 250);
    expect(state.schoolManagement.fundsHistory.at(-1)).toMatchObject({
      kind: "annual-investment",
      amount: -250,
      label: "育成強化予算 Lv.1",
    });

    state = {
      ...state,
      schools: {
        ...state.schools,
        [schoolId]: { ...state.schools[schoolId]!, funds: 5000 },
      },
    };
    state = upgradeAnnualInvestment(state, "development");
    state = upgradeAnnualInvestment(state, "development");
    expect(activeAnnualInvestments(state).levels.development).toBe(3);
    expect(evaluateAnnualInvestmentUpgrade(state, "development")).toMatchObject(
      {
        allowed: false,
        reason: "max-level",
      },
    );
  });

  it("treats the previous year's investment as inactive", () => {
    const state = createDemoGame();
    const invested = upgradeAnnualInvestment(state, "medical");
    const nextYear = { ...invested, yearIndex: invested.yearIndex + 1 };

    expect(activeAnnualInvestments(nextYear).levels.medical).toBe(0);
    expect(annualInvestmentEffects(nextYear).medicalInjuryRiskPercent).toBe(
      100,
    );
  });

  it("exposes meaningful effects for every investment area", () => {
    let state = createDemoGame();
    const schoolId = state.userSchoolId;
    state = {
      ...state,
      schools: {
        ...state.schools,
        [schoolId]: { ...state.schools[schoolId]!, funds: 10000 },
      },
    };
    for (const area of [
      "development",
      "scouting",
      "medical",
      "analysis",
    ] as const) {
      state = upgradeAnnualInvestment(state, area);
      state = upgradeAnnualInvestment(state, area);
      state = upgradeAnnualInvestment(state, area);
    }

    expect(annualInvestmentEffects(state)).toEqual({
      developmentGrowthPercent: 112,
      scoutingAppealBonus: 12,
      medicalInjuryRiskPercent: 65,
      medicalRestConditionBonus: 10,
      analysisDecisionGrowthBonus: 2,
    });
  });
});
