import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { resolveWeeklyTraining } from "../../../../src/domain/training/resolveWeeklyTraining";

function createPlan(state: ReturnType<typeof createDemoGame>) {
  const roster = state.schools[state.userSchoolId]!.playerIds;
  return {
    teamTrainingMenuId: "training.spike",
    individualAssignments: [
      { playerId: roster[0]!, instructionId: "instruction.attack" },
      { playerId: roster[1]!, instructionId: "instruction.defense" },
    ],
  };
}

function resolveWithRest(
  state: ReturnType<typeof createDemoGame>,
  restingPlayerIds: ReadonlySet<PlayerId>,
  seed: string,
) {
  return resolveWeeklyTraining({
    state,
    schoolId: state.userSchoolId,
    plan: createPlan(state),
    data: gameData,
    random: new SeededRandom(seed),
    restingPlayerIds,
  });
}

describe("Phase 8 automatic rest during weekly training", () => {
  it("skips team and individual training for an explicitly resting focus player", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      fatigue: 65,
      condition: 50,
      injury: null,
      abilities: {
        ...state.players[playerId]!.abilities,
        spike: 20,
        jump: 20,
        serve: 20,
      },
    };
    const before = structuredClone(state.players[playerId]!);

    const resolution = resolveWithRest(
      state,
      new Set([playerId]),
      "phase8-fatigue-rest",
    );
    const after = resolution.state.players[playerId]!;
    const log = resolution.result.playerLogs.find(
      (entry) => entry.playerId === playerId,
    )!;

    expect(after.abilities).toEqual(before.abilities);
    expect(after.fatigue).toBe(before.fatigue);
    expect(after.condition).toBe(before.condition);
    expect(after.injury).toEqual(before.injury);
    expect(log.totalAbilityGrowth).toBe(0);
    expect(log.fatigueChange).toBe(0);
    expect(log.conditionChange).toBe(0);
    expect(log.skippedReason).toBe("auto-rest");
  });

  it("does not execute activity-specific RNG for resting players", () => {
    const first = createDemoGame();
    const second = structuredClone(first);
    const restingPlayerIds = new Set([
      first.schools[first.userSchoolId]!.playerIds[0]!,
      first.schools[first.userSchoolId]!.playerIds[1]!,
    ]);

    const firstResolution = resolveWithRest(
      first,
      restingPlayerIds,
      "phase8-rest-rng",
    );
    const secondResolution = resolveWithRest(
      second,
      restingPlayerIds,
      "phase8-rest-rng",
    );

    expect(firstResolution).toEqual(secondResolution);
    expect(firstResolution.result.randomCursor).toBe(
      secondResolution.result.randomCursor,
    );
  });

  it("keeps an injured resting player out of training until week recovery progresses the injury", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[3]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      fatigue: 70,
      condition: 40,
      injury: {
        injuryId: "injury.ankle",
        severity: "moderate",
        remainingWeeks: 3,
        recurrenceRisk: 20,
      },
    };
    const before = structuredClone(state.players[playerId]!);

    const resolution = resolveWithRest(
      state,
      new Set([playerId]),
      "phase8-injury-rest",
    );
    const after = resolution.state.players[playerId]!;
    const log = resolution.result.playerLogs.find(
      (entry) => entry.playerId === playerId,
    )!;

    expect(after.abilities).toEqual(before.abilities);
    expect(after.fatigue).toBe(before.fatigue);
    expect(after.condition).toBe(before.condition);
    expect(after.injury).toEqual(before.injury);
    expect(log.skippedReason).toBe("auto-rest");
  });
});