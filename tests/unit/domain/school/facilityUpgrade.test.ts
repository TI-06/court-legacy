import { createDemoGame } from "../../../../src/app/createDemoGame";
import { schoolId } from "../../../../src/domain/model/identifiers";
import {
  FACILITY_DEFINITIONS,
  calculateFacilityUpgradeCost,
  evaluateFacilityUpgrade,
  upgradeFacility,
  type FacilityKey,
} from "../../../../src/domain/school/facilityUpgrade";

function withFacility(key: FacilityKey, level: number, funds: number) {
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

  it("calculates the next upgrade cost from the current level", () => {
    expect(calculateFacilityUpgradeCost("trainingRoom", 0)).toBe(70);
    expect(calculateFacilityUpgradeCost("trainingRoom", 3)).toBe(280);
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

  it("deducts funds and updates only the requested school facility immutably", () => {
    const state = withFacility("trainingRoom", 0, 300);
    const originalSchool = state.schools[state.userSchoolId]!;
    const rival = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;

    const result = upgradeFacility(state, state.userSchoolId, "trainingRoom");

    expect(result).not.toBe(state);
    expect(result.schools[state.userSchoolId]).not.toBe(originalSchool);
    expect(result.schools[state.userSchoolId]!.funds).toBe(230);
    expect(result.schools[state.userSchoolId]!.facilities.trainingRoom).toBe(1);
    expect(result.schoolManagement.fundsHistory.at(-1)).toMatchObject({
      kind: "facility-upgrade",
      amount: -70,
      balanceAfter: 230,
      relatedId: "trainingRoom",
    });
    expect(result.schools[rival.id]).toBe(rival);
    expect(result.players).toBe(state.players);
    expect(originalSchool.funds).toBe(300);
    expect(originalSchool.facilities.trainingRoom).toBe(0);
  });

  it("does not upgrade when funds are insufficient", () => {
    const state = withFacility("gym", 1, 100);

    expect(
      evaluateFacilityUpgrade(state, state.userSchoolId, "gym"),
    ).toMatchObject({
      allowed: false,
      reason: "insufficient-funds",
      cost: 160,
      fundsAfter: -60,
    });
    expect(upgradeFacility(state, state.userSchoolId, "gym")).toBe(state);
  });

  it("does not upgrade a maximum-level facility", () => {
    const state = withFacility("gym", 5, 9999);

    expect(
      evaluateFacilityUpgrade(state, state.userSchoolId, "gym"),
    ).toMatchObject({
      allowed: false,
      reason: "max-level",
      currentLevel: 5,
      nextLevel: 5,
    });
    expect(upgradeFacility(state, state.userSchoolId, "gym")).toBe(state);
  });

  it("rejects an invalid stored level without changing state", () => {
    const state = withFacility("gym", 6, 9999);

    expect(
      evaluateFacilityUpgrade(state, state.userSchoolId, "gym"),
    ).toMatchObject({
      allowed: false,
      reason: "invalid-level",
    });
    expect(upgradeFacility(state, state.userSchoolId, "gym")).toBe(state);
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
