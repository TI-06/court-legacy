import { describe, expect, it } from "vitest";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { resolvePlayerTrainingActivity } from "../../../../src/domain/training/resolveWeeklyTraining";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;

describe("resolvePlayerTrainingActivity", () => {
  it("reuses normal growth, fatigue, condition, trust, and injury mechanics without mutating input", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const player = {
      ...structuredClone(state.players[playerId]!),
      fatigue: 10,
      condition: 90,
      injury: null,
    };
    const before = structuredClone(player);

    const resolution = resolvePlayerTrainingActivity({
      player,
      school,
      data,
      random: new SeededRandom("single-training-activity"),
      activity: {
        targetAbilities: ["spike", "jump"],
        baseGrowth: 8,
        fatigue: 6,
        injuryRisk: 0,
        trustGrowth: 3,
      },
    });

    expect(resolution.player.id).toBe(playerId);
    expect(resolution.player.abilities.spike).toBeGreaterThanOrEqual(
      before.abilities.spike,
    );
    expect(resolution.player.abilities.jump).toBeGreaterThanOrEqual(
      before.abilities.jump,
    );
    expect(resolution.player.fatigue).toBeGreaterThanOrEqual(before.fatigue);
    expect(resolution.player.condition).toBeLessThanOrEqual(before.condition);
    expect(resolution.log.playerId).toBe(playerId);
    expect(resolution.log.fatigueChange).toBeGreaterThanOrEqual(0);
    expect(resolution.log.modifiers.length).toBeGreaterThan(0);
    expect(player).toEqual(before);
  });

  it("returns the same injured-player skip semantics as weekly training", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const player = {
      ...structuredClone(state.players[playerId]!),
      injury: {
        injuryId: "injury.ankle",
        severity: "moderate" as const,
        remainingWeeks: 2,
        recurrenceRisk: 20,
      },
    };

    const resolution = resolvePlayerTrainingActivity({
      player,
      school,
      data,
      random: new SeededRandom("single-training-injured"),
      activity: {
        targetAbilities: ["receive", "speed"],
        baseGrowth: 8,
        fatigue: 6,
        injuryRisk: 4,
        trustGrowth: 3,
      },
    });

    expect(resolution.player).toEqual(player);
    expect(resolution.log.skippedReason).toBe("injured");
    expect(resolution.log.totalAbilityGrowth).toBe(0);
  });
});
