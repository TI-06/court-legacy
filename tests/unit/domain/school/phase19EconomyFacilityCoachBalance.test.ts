import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  contractAssistantCoach,
  evaluateAssistantCoachContract,
} from "../../../../src/domain/school/assistantCoach";
import {
  calculateFacilityUpgradeTotalCost,
  evaluateFacilityUpgrade,
  upgradeFacility,
} from "../../../../src/domain/school/facilityUpgrade";
import { annualSchoolBudget } from "../../../../src/domain/school/schoolEconomy";

describe("Phase19 PR19-3 economy, facility, and coach balance", () => {
  it("raises annual school budgets without flattening reputation tiers", () => {
    expect(annualSchoolBudget("unknown")).toBe(450);
    expect(annualSchoolBudget("district-contender")).toBe(560);
    expect(annualSchoolBudget("prefectural-power")).toBe(730);
    expect(annualSchoolBudget("national-qualifier")).toBe(950);
    expect(annualSchoolBudget("national-regular")).toBe(1230);
    expect(annualSchoolBudget("elite")).toBe(1570);
  });

  it("sums every intermediate step for +5 and +10 facility upgrades", () => {
    expect(calculateFacilityUpgradeTotalCost("trainingRoom", 0, 5)).toBe(381);
    expect(calculateFacilityUpgradeTotalCost("trainingRoom", 0, 10)).toBe(841);
    expect(calculateFacilityUpgradeTotalCost("gym", 40, 10)).toBe(2804);
  });

  it("applies a +5 upgrade atomically when the full amount is available", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    state.schools[state.userSchoolId] = { ...school, funds: 1000 };

    const evaluation = evaluateFacilityUpgrade(
      state,
      state.userSchoolId,
      "trainingRoom",
      5,
    );
    expect(evaluation).toMatchObject({
      allowed: true,
      currentLevel: 0,
      nextLevel: 5,
      cost: 381,
      fundsAfter: 619,
    });

    const upgraded = upgradeFacility(
      state,
      state.userSchoolId,
      "trainingRoom",
      5,
    );
    expect(upgraded.schools[state.userSchoolId]!.facilities.trainingRoom).toBe(5);
    expect(upgraded.schools[state.userSchoolId]!.funds).toBe(619);
    expect(upgraded.schoolManagement.fundsHistory.at(-1)).toMatchObject({
      kind: "facility-upgrade",
      amount: -381,
      balanceAfter: 619,
    });
  });

  it("does not partially apply a bulk upgrade when funds are insufficient", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    state.schools[state.userSchoolId] = { ...school, funds: 380 };

    expect(
      evaluateFacilityUpgrade(state, state.userSchoolId, "trainingRoom", 5),
    ).toMatchObject({
      allowed: false,
      reason: "insufficient-funds",
      currentLevel: 0,
      nextLevel: 5,
      cost: 381,
      fundsAfter: -1,
    });
    expect(
      upgradeFacility(state, state.userSchoolId, "trainingRoom", 5),
    ).toBe(state);
  });

  it("rejects +5/+10 plans that would cross level 50", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    state.schools[state.userSchoolId] = {
      ...school,
      funds: 9999,
      facilities: { ...school.facilities, gym: 47 },
    };

    expect(
      evaluateFacilityUpgrade(state, state.userSchoolId, "gym", 5),
    ).toMatchObject({ allowed: false, reason: "max-level", currentLevel: 47 });
    expect(
      evaluateFacilityUpgrade(state, state.userSchoolId, "gym", 10),
    ).toMatchObject({ allowed: false, reason: "max-level", currentLevel: 47 });
  });

  it("can reach level 50 through a valid concentrated +10 plan", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    state.schools[state.userSchoolId] = {
      ...school,
      funds: 9999,
      facilities: { ...school.facilities, gym: 40 },
    };

    const upgraded = upgradeFacility(state, state.userSchoolId, "gym", 10);
    expect(upgraded.schools[state.userSchoolId]!.facilities.gym).toBe(50);
    expect(upgraded.schools[state.userSchoolId]!.funds).toBe(7195);
  });

  it("allows only one assistant coach contract per academic year", () => {
    const state = createDemoGame();
    const first = contractAssistantCoach(state, "intermediate", "attack");
    const firstFunds = first.schools[first.userSchoolId]!.funds;

    expect(
      evaluateAssistantCoachContract(first, "advanced", "defense"),
    ).toMatchObject({
      allowed: false,
      reason: "already-contracted-this-year",
    });
    expect(contractAssistantCoach(first, "advanced", "defense")).toBe(first);
    expect(first.schools[first.userSchoolId]!.funds).toBe(firstFunds);
  });
});
