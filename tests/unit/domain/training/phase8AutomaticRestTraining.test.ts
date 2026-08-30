import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { resolveWeeklyTraining } from "../../../../src/domain/training/resolveWeeklyTraining";

function createPlan(state: ReturnType<typeof createDemoGame>) {
  const roster = state.schools[state.userSchoolId]!.playerIds;
  return {
    teamTrainingMenuId: "training.spike",
    individualAssignments: [
      { playerId: roster[0]!, instructionId: "instruction.serve" },
      { playerId: roster[1]!, instructionId: "instruction.receive" },
    ],
  };
}

describe("Phase 8 automatic rest during weekly training", () => {
  it("skips team and individual training for a player at the fatigue threshold and gives extra recovery", () => {
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

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: createPlan(state),
      data: gameData,
      random: new SeededRandom("phase8-fatigue-rest"),
    });
    const after = resolution.state.players[playerId]!;
    const log = resolution.result.playerLogs.find(
      (entry) => entry.playerId === playerId,
    )!;

    expect(after.abilities).toEqual(before.abilities);
    expect(after.fatigue).toBeLessThan(before.fatigue);
    expect(after.condition).toBeGreaterThan(before.condition);
    expect(log.totalAbilityGrowth).toBe(0);
    expect(log.skippedReason).toBe("automatic-rest");
  });

  it("skips training for a player at the low-condition threshold", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[2]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      fatigue: 10,
      condition: 35,
      injury: null,
      abilities: {
        ...state.players[playerId]!.abilities,
        spike: 20,
        jump: 20,
      },
    };
    const before = structuredClone(state.players[playerId]!);

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: createPlan(state),
      data: gameData,
      random: new SeededRandom("phase8-condition-rest"),
    });
    const after = resolution.state.players[playerId]!;
    const log = resolution.result.playerLogs.find(
      (entry) => entry.playerId === playerId,
    )!;

    expect(after.abilities).toEqual(before.abilities);
    expect(after.condition).toBeGreaterThan(before.condition);
    expect(log.totalAbilityGrowth).toBe(0);
    expect(log.skippedReason).toBe("automatic-rest");
  });

  it("keeps injured players out of training while still giving rest recovery", () => {
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

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: createPlan(state),
      data: gameData,
      random: new SeededRandom("phase8-injury-rest"),
    });
    const after = resolution.state.players[playerId]!;
    const log = resolution.result.playerLogs.find(
      (entry) => entry.playerId === playerId,
    )!;

    expect(after.abilities).toEqual(before.abilities);
    expect(after.fatigue).toBeLessThan(before.fatigue);
    expect(after.condition).toBeGreaterThan(before.condition);
    expect(after.injury).toEqual(before.injury);
    expect(log.skippedReason).toBe("injured");
  });
});
