import type { GameState, PlayerDevelopmentWeek } from "../model/GameState";
import type { TrainingResult } from "../training/resolveWeeklyTraining";

export const MAX_PLAYER_DEVELOPMENT_WEEKS = 52;

export interface BuildPlayerDevelopmentWeekInput {
  stateBeforeTraining: GameState;
  result: TrainingResult;
}

export function buildPlayerDevelopmentWeek(
  input: BuildPlayerDevelopmentWeekInput,
): PlayerDevelopmentWeek {
  return {
    gameDate: input.stateBeforeTraining.date,
    academicYearIndex: input.stateBeforeTraining.yearIndex,
    weekOfYear: input.stateBeforeTraining.calendar.weekOfYear,
    trainingMenuId: input.result.teamTrainingMenuId,
    players: input.result.playerLogs.map((log) => ({
      playerId: log.playerId,
      totalAbilityGrowth: log.totalAbilityGrowth,
      abilityChanges: { ...log.abilityChanges },
    })),
  };
}

function sameDevelopmentWeek(
  left: PlayerDevelopmentWeek,
  right: PlayerDevelopmentWeek,
): boolean {
  return (
    left.gameDate === right.gameDate &&
    left.academicYearIndex === right.academicYearIndex &&
    left.weekOfYear === right.weekOfYear
  );
}

export function appendPlayerDevelopmentWeek(
  history: readonly PlayerDevelopmentWeek[],
  week: PlayerDevelopmentWeek,
): PlayerDevelopmentWeek[] {
  if (history.some((candidate) => sameDevelopmentWeek(candidate, week))) {
    return [...history];
  }

  return [...history, week].slice(-MAX_PLAYER_DEVELOPMENT_WEEKS);
}
