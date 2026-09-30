import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import {
  activeSchoolInvestmentPlan,
  evaluateSchoolInvestment,
  purchaseSchoolInvestment,
  schoolInvestmentTrainingModifiers,
  scoutingInvestmentAppealBonus,
  trainingCampInvestmentModifier,
} from "../../../../src/domain/school/schoolInvestment";

function stateFixture() {
  const state = createInitialGame({
    seed: "school-investment-fixture",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高橋 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
  const school = state.schools[state.userSchoolId]!;
  state.schools[state.userSchoolId] = { ...school, funds: 5000 };
  return state;
}

describe("school investment programs", () => {
  it("spends funds once per category and records the annual plan", () => {
    const state = stateFixture();
    const before = state.schools[state.userSchoolId]!.funds;
    const invested = purchaseSchoolInvestment(state, "development", "attack");

    expect(invested.schools[invested.userSchoolId]!.funds).toBe(before - 350);
    expect(activeSchoolInvestmentPlan(invested)?.developmentFocus).toBe(
      "attack",
    );
    expect(invested.schoolManagement.fundsHistory.at(-1)).toMatchObject({
      kind: "school-investment",
      amount: -350,
      label: "年間強化予算",
    });

    expect(
      evaluateSchoolInvestment(invested, "development", "defense"),
    ).toMatchObject({ allowed: false, reason: "already-selected" });
  });

  it("applies development and position specialist growth only to matching training", () => {
    let state = stateFixture();
    state = purchaseSchoolInvestment(state, "development", "attack");
    state = purchaseSchoolInvestment(state, "external-coach", "setter");
    const school = state.schools[state.userSchoolId]!;
    const setter = school.playerIds
      .map((id) => state.players[id]!)
      .find((player) => player.preferredPosition === "S")!;
    const libero = school.playerIds
      .map((id) => state.players[id]!)
      .find((player) => player.preferredPosition === "L")!;

    expect(schoolInvestmentTrainingModifiers(state, setter, ["set"])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "school-development-investment",
          percent: 110,
        }),
        expect.objectContaining({
          code: "external-specialist-coach",
          percent: 115,
        }),
      ]),
    );
    expect(
      schoolInvestmentTrainingModifiers(state, libero, ["receive"]),
    ).toHaveLength(0);
  });

  it("exposes camp and scouting bonuses only for the current academic year", () => {
    let state = stateFixture();
    state = purchaseSchoolInvestment(state, "camp", "elite");
    state = purchaseSchoolInvestment(state, "scouting", "national");

    expect(trainingCampInvestmentModifier(state)).toEqual({
      growthPercent: 125,
      specialAbilityBonus: 12,
    });
    expect(scoutingInvestmentAppealBonus(state)).toBe(12);

    const nextYear = { ...state, yearIndex: state.yearIndex + 1 };
    expect(activeSchoolInvestmentPlan(nextYear)).toBeNull();
    expect(trainingCampInvestmentModifier(nextYear)).toEqual({
      growthPercent: 100,
      specialAbilityBonus: 0,
    });
    expect(scoutingInvestmentAppealBonus(nextYear)).toBe(0);
  });

  it("rejects mismatched category options", () => {
    const state = stateFixture();
    expect(() =>
      evaluateSchoolInvestment(state, "development", "national"),
    ).toThrow("invalid development investment option");
  });
});
