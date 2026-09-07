import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { GameState } from "../../../../src/domain/model/GameState";
import { schoolId } from "../../../../src/domain/model/identifiers";
import {
  FACILITY_DEFINITIONS,
  FACILITY_MAX_LEVEL,
  calculateFacilityUpgradeCost,
  evaluateFacilityUpgrade,
  facilityMilestone,
  upgradeFacility,
  type FacilityKey,
} from "../../../../src/domain/school/facilityUpgrade";

function withFacility(
  key: FacilityKey,
  level: number,
  funds: number,
): GameState {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  return {
    ...state,
    schools: {
      ...state.schools,
      [state.userSchoolId]: {
        ...school,
        funds,
        facilities: {
          ...school.facilities,
          [key]: level,
        },
      },
    },
  };
}

describe("facility upgrades", () => {
  it("defines all eight facilities with their base costs", () => {
    expect(FACILITY_DEFINITIONS).toHaveLength(8);
    expect(FACILITY_MAX_LEVEL).toBe(50);
    expect(
      Object.fromEntries(
        FACILITY_DEFINITIONS.map((definition) => [
          definition.key,
          definition.baseCost,
        ]),
      ),
    ).toEqual({
      gym: 80,
      trainingRoom: 70,
      analysisRoom: 55,
      recoveryRoom: 60,
      dormitory: 90,
      scoutingNetwork: 75,
      alumniAssociation: 50,
      studyRoom: 45,
    });
  });

  it("calculates the approved Lv.0-50 upgrade cost curve", () => {
    expect(calculateFacilityUpgradeCost("trainingRoom", 0)).toBe(70);
    expect(calculateFacilityUpgradeCost("trainingRoom", 3)).toBe(83);
    expect(calculateFacilityUpgradeCost("gym", 49)).toBe(315);
  });

  it("evaluates an available upgrade without mutating state", () => {
    const state = withFacility("trainingRoom", 0, 300);

    const evaluation = evaluateFacilityUpgrade(
      state,
      state.userSchoolId,
      "trainingRoom",
    );

    expect(evaluation).toEqual({
      allowed: true,
      reason: "available",
      currentLevel: 0,
      nextLevel: 1,
      cost: 70,
      fundsAfter: 230,
    });
    expect(state.schools[state.userSchoolId]!.funds).toBe(300);
  });

  it("upgrades a level 49 facility to level 50 and records the ledger", () => {
    const state = withFacility("gym", 49, 1000);

    const result = upgradeFacility(state, state.userSchoolId, "gym");

    expect(result.schools[state.userSchoolId]!.facilities.gym).toBe(50);
    expect(result.schools[state.userSchoolId]!.funds).toBe(685);
    expect(result.schoolManagement.fundsHistory.at(-1)).toMatchObject({
      kind: "facility-upgrade",
      amount: -315,
      balanceAfter: 685,
      relatedId: "gym",
    });
  });

  it("does not upgrade when funds are insufficient", () => {
    const state = withFacility("gym", 10, 100);

    expect(
      evaluateFacilityUpgrade(state, state.userSchoolId, "gym"),
    ).toMatchObject({
      allowed: false,
      reason: "insufficient-funds",
      cost: 128,
      fundsAfter: -28,
    });
    expect(upgradeFacility(state, state.userSchoolId, "gym")).toBe(state);
  });

  it("does not upgrade a level 50 facility", () => {
    const state = withFacility("gym", 50, 9999);

    expect(
      evaluateFacilityUpgrade(state, state.userSchoolId, "gym"),
    ).toMatchObject({
      allowed: false,
      reason: "max-level",
      currentLevel: 50,
      nextLevel: 50,
    });
    expect(upgradeFacility(state, state.userSchoolId, "gym")).toBe(state);
  });

  it("rejects an invalid stored level above 50 without changing state", () => {
    const state = withFacility("gym", 51, 9999);

    expect(
      evaluateFacilityUpgrade(state, state.userSchoolId, "gym"),
    ).toMatchObject({
      allowed: false,
      reason: "invalid-level",
    });
    expect(upgradeFacility(state, state.userSchoolId, "gym")).toBe(state);
  });

  it("reports the next five-level milestone", () => {
    expect(facilityMilestone(0)).toEqual({ nextLevel: 5, completedLevel: 0 });
    expect(facilityMilestone(17)).toEqual({ nextLevel: 20, completedLevel: 15 });
    expect(facilityMilestone(50)).toEqual({ nextLevel: 50, completedLevel: 50 });
  });

  it("throws for an unknown school or facility key", () => {
    const state = createDemoGame();

    expect(() =>
      evaluateFacilityUpgrade(state, schoolId("missing-school"), "gym"),
    ).toThrow("unknown school");
    expect(() =>
      calculateFacilityUpgradeCost("missing" as FacilityKey, 0),
    ).toThrow("unknown facility");
  });
});
