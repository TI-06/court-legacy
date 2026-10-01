import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  SCHOOL_SPECIAL_PROJECT_YEARLY_LIMIT,
  activeSchoolSpecialProjects,
  evaluateSchoolSpecialProject,
  purchaseSchoolSpecialProject,
  schoolSpecialProjectRemainingSlots,
} from "../../../../src/domain/school/schoolSpecialProjects";

function createReadyState() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  school.funds = 5000;
  school.reputationPoints = 900;
  school.history.nationalTitles = 1;
  school.facilities = {
    gym: 50,
    trainingRoom: 50,
    analysisRoom: 50,
    recoveryRoom: 50,
    dormitory: 50,
    scoutingNetwork: 50,
    alumniAssociation: 50,
    studyRoom: 50,
  };
  return state;
}

describe("Phase51 school special projects", () => {
  it("unlocks projects from facility, reputation, and achievement requirements", () => {
    const state = createDemoGame();

    const dataBank = evaluateSchoolSpecialProject(state, "national-data-bank");
    expect(dataBank.allowed).toBe(false);
    expect(dataBank.reason).toBe("requirements-not-met");
    expect(dataBank.requirements.unmetFacilities).toContain("analysisRoom");

    const ready = createReadyState();
    expect(
      evaluateSchoolSpecialProject(ready, "national-data-bank"),
    ).toMatchObject({
      allowed: true,
      reason: "available",
      cost: 900,
      fundsAfter: 4100,
    });
    expect(
      evaluateSchoolSpecialProject(ready, "invitational-cup"),
    ).toMatchObject({
      allowed: true,
      reason: "available",
      cost: 1800,
    });
  });

  it("debits funds once and stores only the current academic year's selected ids", () => {
    const state = createReadyState();

    const purchased = purchaseSchoolSpecialProject(
      state,
      "national-data-bank",
    );

    expect(
      purchased.schools[purchased.userSchoolId]!.funds,
    ).toBe(4100);
    expect(activeSchoolSpecialProjects(purchased)).toEqual({
      yearIndex: state.yearIndex,
      purchasedProjectIds: ["national-data-bank"],
    });
    expect(purchased.schoolManagement.fundsHistory.at(-1)).toMatchObject({
      kind: "special-project",
      amount: -900,
      balanceAfter: 4100,
      relatedId: "national-data-bank",
    });
    expect(state.schoolManagement.specialProjects).toBeUndefined();
  });

  it("rejects duplicates and enforces the two-project annual cap", () => {
    const state = createReadyState();
    const first = purchaseSchoolSpecialProject(state, "national-data-bank");

    expect(
      evaluateSchoolSpecialProject(first, "national-data-bank").reason,
    ).toBe("already-purchased");

    const second = purchaseSchoolSpecialProject(first, "medical-support");
    expect(activeSchoolSpecialProjects(second)?.purchasedProjectIds).toEqual([
      "national-data-bank",
      "medical-support",
    ]);
    expect(schoolSpecialProjectRemainingSlots(second)).toBe(0);
    expect(SCHOOL_SPECIAL_PROJECT_YEARLY_LIMIT).toBe(2);

    const thirdEvaluation = evaluateSchoolSpecialProject(
      second,
      "academic-support",
    );
    expect(thirdEvaluation.allowed).toBe(false);
    expect(thirdEvaluation.reason).toBe("yearly-limit");
    expect(
      purchaseSchoolSpecialProject(second, "academic-support"),
    ).toBe(second);
  });

  it("treats a previous-year project state as inactive instead of growing history", () => {
    const state = createReadyState();
    state.schoolManagement.specialProjects = {
      yearIndex: state.yearIndex - 1,
      purchasedProjectIds: ["national-data-bank", "medical-support"],
    };

    expect(activeSchoolSpecialProjects(state)).toBeNull();
    expect(schoolSpecialProjectRemainingSlots(state)).toBe(2);

    const purchased = purchaseSchoolSpecialProject(state, "academic-support");
    expect(activeSchoolSpecialProjects(purchased)).toEqual({
      yearIndex: state.yearIndex,
      purchasedProjectIds: ["academic-support"],
    });
  });

  it("does not mutate state when funds are insufficient", () => {
    const state = createReadyState();
    state.schools[state.userSchoolId]!.funds = 700;

    const evaluation = evaluateSchoolSpecialProject(state, "academic-support");
    expect(evaluation).toMatchObject({
      allowed: false,
      reason: "insufficient-funds",
      cost: 750,
      fundsAfter: -50,
    });
    expect(purchaseSchoolSpecialProject(state, "academic-support")).toBe(state);
  });
});
