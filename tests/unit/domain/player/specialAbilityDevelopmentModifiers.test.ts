import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  adjustSpecialAbilityInjuryRisk,
  getSpecialAbilityRecoveryValues,
  getSpecialAbilityTipChances,
  getSpecialAbilityTrainingGrowthPercent,
} from "../../../../src/domain/player/specialAbilityDevelopmentModifiers";

function playerWith(...specialAbilityIds: string[]) {
  const state = createDemoGame();
  const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
  return {
    ...structuredClone(state.players[playerId]!),
    specialAbilityIds,
  };
}

describe("special ability development modifiers", () => {
  it("applies growth abilities additively", () => {
    expect(getSpecialAbilityTrainingGrowthPercent(playerWith())).toBe(100);
    expect(
      getSpecialAbilityTrainingGrowthPercent(playerWith("growth_motivation")),
    ).toBe(108);
    expect(
      getSpecialAbilityTrainingGrowthPercent(playerWith("growth_practice")),
    ).toBe(106);
    expect(
      getSpecialAbilityTrainingGrowthPercent(
        playerWith("growth_motivation", "growth_practice"),
      ),
    ).toBe(114);
  });

  it("moves training injury risk in the expected direction", () => {
    expect(
      adjustSpecialAbilityInjuryRisk(
        playerWith("physical_injury_resist"),
        50,
      ),
    ).toBe(35);
    expect(
      adjustSpecialAbilityInjuryRisk(
        playerWith("physical_injury_prone"),
        50,
      ),
    ).toBe(68);
  });

  it("improves camp tip chances for practice talent", () => {
    expect(getSpecialAbilityTipChances(playerWith())).toEqual({
      progressPercent: 38,
      doubleTipPercent: 12,
    });
    expect(
      getSpecialAbilityTipChances(playerWith("growth_practice")),
    ).toEqual({
      progressPercent: 50,
      doubleTipPercent: 20,
    });
  });

  it("improves explicit recovery effects without reviving weekly auto recovery", () => {
    expect(getSpecialAbilityRecoveryValues(playerWith())).toEqual({
      fatigueRecovery: 40,
      conditionRecovery: 10,
      restConditionBonus: 0,
    });
    expect(
      getSpecialAbilityRecoveryValues(playerWith("physical_recovery")),
    ).toEqual({
      fatigueRecovery: 55,
      conditionRecovery: 15,
      restConditionBonus: 5,
    });
  });
});
