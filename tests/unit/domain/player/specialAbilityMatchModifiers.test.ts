import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { Player } from "../../../../src/domain/model/Player";
import {
  getServeSpecialAbilityAdjustment,
  getSpecialAbilityAbilityDelta,
  type MatchSpecialAbilitySituation,
} from "../../../../src/domain/player/specialAbilityMatchModifiers";

function playerWithAbilities(...abilityIds: string[]): Player {
  const state = createDemoGame();
  const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
  return {
    ...state.players[playerId]!,
    specialAbilityIds: abilityIds,
  };
}

const normalSituation: MatchSpecialAbilitySituation = {
  ownScore: 8,
  opponentScore: 7,
  setNumber: 1,
  bestOfSets: 3,
};

const criticalSituation: MatchSpecialAbilitySituation = {
  ownScore: 23,
  opponentScore: 22,
  setNumber: 1,
  bestOfSets: 3,
};

describe("special ability match modifiers", () => {
  it("applies blue and red serve abilities in opposite directions", () => {
    const stable = playerWithAbilities("serve_stable");
    const unstable = playerWithAbilities("serve_unstable");

    expect(
      getSpecialAbilityAbilityDelta(stable, "serve", normalSituation),
    ).toBeGreaterThan(0);
    expect(
      getSpecialAbilityAbilityDelta(unstable, "serve", normalSituation),
    ).toBeLessThan(0);

    const stableServe = getServeSpecialAbilityAdjustment(
      stable,
      normalSituation,
    );
    const unstableServe = getServeSpecialAbilityAdjustment(
      unstable,
      normalSituation,
    );
    expect(stableServe.errorChanceDelta).toBeLessThan(0);
    expect(unstableServe.errorChanceDelta).toBeGreaterThan(0);
  });

  it("activates clutch abilities only in late close scores", () => {
    const player = playerWithAbilities("mental_clutch", "attack_clutch");

    expect(
      getSpecialAbilityAbilityDelta(player, "mental", normalSituation),
    ).toBe(0);
    expect(
      getSpecialAbilityAbilityDelta(player, "spike", normalSituation),
    ).toBe(0);

    expect(
      getSpecialAbilityAbilityDelta(player, "mental", criticalSituation),
    ).toBeGreaterThan(0);
    expect(
      getSpecialAbilityAbilityDelta(player, "spike", criticalSituation),
    ).toBeGreaterThan(0);
  });

  it("makes pressure serve weakness matter only in the clutch", () => {
    const player = playerWithAbilities("serve_pressure_bad");

    expect(
      getServeSpecialAbilityAdjustment(player, normalSituation)
        .errorChanceDelta,
    ).toBe(0);
    expect(
      getServeSpecialAbilityAdjustment(player, criticalSituation)
        .errorChanceDelta,
    ).toBeGreaterThan(0);
  });

  it("gives elite and gold abilities stronger direct match effects", () => {
    const normal = playerWithAbilities("serve_stable");
    const elite = playerWithAbilities("elite_serve_craftsman");
    const gold = playerWithAbilities("gold_serve_king");

    const normalDelta = getSpecialAbilityAbilityDelta(
      normal,
      "serve",
      normalSituation,
    );
    const eliteDelta = getSpecialAbilityAbilityDelta(
      elite,
      "serve",
      normalSituation,
    );
    const goldDelta = getSpecialAbilityAbilityDelta(
      gold,
      "serve",
      normalSituation,
    );

    expect(eliteDelta).toBeGreaterThan(normalDelta);
    expect(goldDelta).toBeGreaterThan(eliteDelta);
    expect(
      getServeSpecialAbilityAdjustment(gold, normalSituation).aceChanceDelta,
    ).toBeGreaterThan(
      getServeSpecialAbilityAdjustment(normal, normalSituation).aceChanceDelta,
    );
  });

  it("stacks compatible abilities without consuming randomness", () => {
    const player = playerWithAbilities(
      "receive_serve",
      "receive_range",
      "elite_defense_craftsman",
    );

    expect(
      getSpecialAbilityAbilityDelta(player, "receive", normalSituation),
    ).toBe(12);
    expect(
      getSpecialAbilityAbilityDelta(player, "speed", normalSituation),
    ).toBe(6);
  });
});
