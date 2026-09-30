import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  ANNUAL_INVESTMENT_DEFINITIONS,
  activeAnnualInvestments,
  annualCampGrowthPercent,
  annualInvestmentsUnlocked,
  annualScoutingCandidateBonus,
  annualTrainingGrowthPercent,
  purchaseAnnualInvestment,
} from "../../../../src/domain/school/annualInvestment";

function maxedState() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  return {
    ...state,
    schools: {
      ...state.schools,
      [school.id]: {
        ...school,
        funds: 10000,
        facilities: Object.fromEntries(
          Object.keys(school.facilities).map((key) => [key, 50]),
        ) as typeof school.facilities,
      },
    },
  };
}

describe("annual strengthening investments", () => {
  it("unlocks only after every facility reaches level 50", () => {
    const state = maxedState();
    expect(annualInvestmentsUnlocked(state)).toBe(true);

    state.schools[state.userSchoolId]!.facilities.gym = 49;
    expect(annualInvestmentsUnlocked(state)).toBe(false);
  });

  it("spends funds and activates stackable annual effects", () => {
    let state = maxedState();
    state = purchaseAnnualInvestment(state, "training");
    state = purchaseAnnualInvestment(state, "specialist-coach");
    state = purchaseAnnualInvestment(state, "camp");
    state = purchaseAnnualInvestment(state, "scouting");

    expect(activeAnnualInvestments(state)).toEqual([
      "training",
      "specialist-coach",
      "camp",
      "scouting",
    ]);
    expect(annualTrainingGrowthPercent(state)).toBe(13);
    expect(annualCampGrowthPercent(state)).toBe(20);
    expect(annualScoutingCandidateBonus(state)).toBe(1);
    expect(state.schools[state.userSchoolId]!.funds).toBe(
      10000 -
        ANNUAL_INVESTMENT_DEFINITIONS.reduce(
          (sum, definition) => sum + definition.cost,
          0,
        ),
    );
    expect(state.schoolManagement.fundsHistory.at(-1)).toMatchObject({
      kind: "annual-investment",
      amount: -1000,
      relatedId: "scouting",
    });
  });

  it("prevents the same investment twice in one year and expires effects next year", () => {
    let state = purchaseAnnualInvestment(maxedState(), "training");

    expect(() => purchaseAnnualInvestment(state, "training")).toThrow(
      "already purchased",
    );

    state = { ...state, yearIndex: state.yearIndex + 1 };
    expect(activeAnnualInvestments(state)).toEqual([]);
    expect(annualTrainingGrowthPercent(state)).toBe(0);
  });
});
