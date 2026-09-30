import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  annualInvestmentTrainingModifiers,
  annualTrainingCampGrowthModifiers,
  applyAnnualScoutingInvestment,
  currentAnnualInvestmentPlan,
  evaluateAnnualInvestment,
  investAnnualProgram,
} from "../../../../src/domain/school/annualInvestment";

describe("annual school investment", () => {
  it("spends funds progressively and caps each program at level three", () => {
    let state = createDemoGame();
    const initialFunds = state.schools[state.userSchoolId]!.funds;

    state = investAnnualProgram(state, "training");
    expect(currentAnnualInvestmentPlan(state).trainingLevel).toBe(1);
    expect(state.schools[state.userSchoolId]!.funds).toBe(initialFunds - 180);

    state = investAnnualProgram(state, "training");
    expect(currentAnnualInvestmentPlan(state).trainingLevel).toBe(2);
    expect(state.schools[state.userSchoolId]!.funds).toBe(
      initialFunds - 180 - 320,
    );

    state = investAnnualProgram(state, "training");
    expect(currentAnnualInvestmentPlan(state).trainingLevel).toBe(3);
    expect(
      evaluateAnnualInvestment(state, "training").reason,
    ).toBe("max-level");
    expect(
      state.schoolManagement.fundsHistory.at(-1),
    ).toMatchObject({
      kind: "annual-investment",
      label: "育成支援 Lv.3",
      amount: -500,
    });
  });

  it("locks the specialist focus after the first investment", () => {
    let state = createDemoGame();

    state = investAnnualProgram(state, "specialist", "defense");
    expect(currentAnnualInvestmentPlan(state)).toMatchObject({
      specialistLevel: 1,
      specialistFocus: "defense",
    });
    expect(
      evaluateAnnualInvestment(state, "specialist", "attack").reason,
    ).toBe("specialist-focus-locked");

    const defenseModifiers = annualInvestmentTrainingModifiers(state, [
      "receive",
    ]);
    const attackModifiers = annualInvestmentTrainingModifiers(state, ["spike"]);
    expect(
      defenseModifiers.some(
        (modifier) => modifier.code === "annual-investment-specialist",
      ),
    ).toBe(true);
    expect(
      attackModifiers.some(
        (modifier) => modifier.code === "annual-investment-specialist",
      ),
    ).toBe(false);
  });

  it("adds persistent training and camp bonuses for the current year", () => {
    let state = createDemoGame();
    state = investAnnualProgram(state, "training");
    state = investAnnualProgram(state, "camp");

    expect(annualInvestmentTrainingModifiers(state, ["spike"])).toContainEqual(
      expect.objectContaining({
        code: "annual-investment-training",
        percent: 103,
      }),
    );
    expect(annualTrainingCampGrowthModifiers(state)).toEqual([
      expect.objectContaining({
        code: "annual-investment-camp",
        percent: 110,
      }),
    ]);
  });

  it("moves scouting probability out of normal candidates while preserving the total", () => {
    let state = createDemoGame();
    state = investAnnualProgram(state, "scouting");

    const baseline = {
      normal: 7000,
      promising: 2200,
      elite: 700,
      generational: 80,
      monster: 20,
    };
    const boosted = applyAnnualScoutingInvestment(baseline, state);

    expect(Object.values(boosted).reduce((sum, value) => sum + value, 0)).toBe(
      10_000,
    );
    expect(boosted.normal).toBeLessThan(baseline.normal);
    expect(boosted.elite).toBeGreaterThan(baseline.elite);
    expect(boosted.generational).toBeGreaterThan(baseline.generational);
  });

  it("treats a stale previous-year investment plan as level zero", () => {
    const state = createDemoGame();
    state.schoolManagement.annualInvestment = {
      yearIndex: state.yearIndex - 1,
      trainingLevel: 3,
      specialistLevel: 3,
      campLevel: 3,
      scoutingLevel: 3,
      specialistFocus: "attack",
    };

    expect(currentAnnualInvestmentPlan(state)).toMatchObject({
      yearIndex: state.yearIndex,
      trainingLevel: 0,
      specialistLevel: 0,
      campLevel: 0,
      scoutingLevel: 0,
      specialistFocus: null,
    });
  });
});
