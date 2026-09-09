import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { GameState } from "../../../../src/domain/model/GameState";
import type { GameDate } from "../../../../src/domain/model/identifiers";
import {
  appendPlayerDevelopmentWeek,
  buildPlayerDevelopmentWeek,
  MAX_PLAYER_DEVELOPMENT_WEEKS,
} from "../../../../src/domain/player/playerDevelopmentHistory";
import type { TrainingResult } from "../../../../src/domain/training/resolveWeeklyTraining";

function trainingResult(state: GameState): TrainingResult {
  const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
  return {
    schoolId: state.userSchoolId,
    teamTrainingMenuId: "training.spike",
    individualAssignments: [],
    injuredPlayerIds: [],
    randomCursor: state.randomCursor,
    playerLogs: [
      {
        playerId,
        abilityChanges: { attack: 2, jump: 1 },
        totalAbilityGrowth: 3,
        fatigueChange: 0,
        conditionChange: 0,
        trustChange: 0,
        academicRestricted: false,
        injuryRisk: 0,
        injury: null,
        skippedReason: null,
        modifiers: [],
      },
    ],
  };
}

describe("playerDevelopmentHistory", () => {
  it("builds a persisted week from authoritative training logs and clones deltas", () => {
    const state = createDemoGame();
    const result = trainingResult(state);

    const week = buildPlayerDevelopmentWeek({
      stateBeforeTraining: state,
      result,
    });

    expect(week).toEqual({
      gameDate: state.date,
      academicYearIndex: state.yearIndex,
      weekOfYear: state.calendar.weekOfYear,
      trainingMenuId: result.teamTrainingMenuId,
      players: [
        {
          playerId: result.playerLogs[0]!.playerId,
          totalAbilityGrowth: 3,
          abilityChanges: { attack: 2, jump: 1 },
        },
      ],
    });

    result.playerLogs[0]!.abilityChanges.attack = 99;
    expect(week.players[0]!.abilityChanges.attack).toBe(2);
  });

  it("does not append the same game week twice", () => {
    const state = createDemoGame();
    const week = buildPlayerDevelopmentWeek({
      stateBeforeTraining: state,
      result: trainingResult(state),
    });

    const once = appendPlayerDevelopmentWeek([], week);
    const twice = appendPlayerDevelopmentWeek(once, week);

    expect(twice).toHaveLength(1);
    expect(twice).toEqual(once);
  });

  it("retains only the newest 52 weekly entries", () => {
    const state = createDemoGame();
    const result = trainingResult(state);
    let history = [] as ReturnType<typeof appendPlayerDevelopmentWeek>;

    for (let index = 0; index < MAX_PLAYER_DEVELOPMENT_WEEKS + 1; index += 1) {
      const week = buildPlayerDevelopmentWeek({
        stateBeforeTraining: {
          ...state,
          date: `2026-04-${String(index + 1).padStart(2, "0")}` as GameDate,
          calendar: {
            ...state.calendar,
            weekOfYear: index + 1,
          },
        },
        result,
      });
      history = appendPlayerDevelopmentWeek(history, week);
    }

    expect(history).toHaveLength(MAX_PLAYER_DEVELOPMENT_WEEKS);
    expect(history[0]!.weekOfYear).toBe(2);
    expect(history.at(-1)!.weekOfYear).toBe(MAX_PLAYER_DEVELOPMENT_WEEKS + 1);
  });
});
