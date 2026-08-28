import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  SPECIAL_COACH_ACTIVITY,
  SPECIAL_COACH_FOCUS_ABILITIES,
  TRAINING_CAMP_ACTIVITY,
  TRAINING_CAMP_POSITION_ABILITIES,
  applyFatigueRecovery,
  isFatigueRecoveryEligible,
} from "../../../../src/domain/shop/shopEffects";

describe("Phase 5 shop training effects", () => {
  it("recovers fatigue and condition with fixed clamps while preserving unrelated player state", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = {
      ...structuredClone(state.players[playerId]!),
      fatigue: 25,
      condition: 95,
    };
    const before = structuredClone(player);

    const result = applyFatigueRecovery(player);

    expect(result.before).toEqual({ fatigue: 25, condition: 95 });
    expect(result.after).toEqual({ fatigue: 0, condition: 100 });
    expect(result.player.fatigue).toBe(0);
    expect(result.player.condition).toBe(100);
    expect({ ...result.player, fatigue: 25, condition: 95 }).toEqual(before);
    expect(player).toEqual(before);
  });

  it("marks a fully recovered player as ineligible to prevent no-op consumption", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = {
      ...structuredClone(state.players[playerId]!),
      fatigue: 0,
      condition: 100,
    };

    expect(isFatigueRecoveryEligible(player)).toBe(false);
    expect(() => applyFatigueRecovery(player)).toThrow(
      "fatigue recovery would be a no-op",
    );
  });

  it("defines the exact six special-coach focus mappings and server activity", () => {
    expect(SPECIAL_COACH_FOCUS_ABILITIES).toEqual({
      spike: ["spike", "jump"],
      serve: ["serve", "mental"],
      receive: ["receive", "speed"],
      block: ["block", "jump"],
      physical: ["stamina", "speed", "jump"],
      decision: ["decision", "set", "mental"],
    });
    expect(SPECIAL_COACH_ACTIVITY).toEqual({
      baseGrowth: 8,
      fatigue: 6,
      injuryRisk: 4,
      trustGrowth: 3,
    });
  });

  it("defines deterministic training-camp position profiles and fixed server activity", () => {
    expect(TRAINING_CAMP_POSITION_ABILITIES).toEqual({
      OH: ["spike", "receive", "serve"],
      MB: ["block", "jump", "speed"],
      OP: ["spike", "serve", "block"],
      S: ["set", "decision", "speed"],
      L: ["receive", "speed", "mental"],
    });
    expect(TRAINING_CAMP_ACTIVITY).toEqual({
      baseGrowth: 3,
      fatigue: 12,
      injuryRisk: 5,
      trustGrowth: 2,
    });
  });
});
