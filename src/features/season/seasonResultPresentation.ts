import type {
  SeasonGoalResult,
  SeasonGoalSeasonSummary,
  SeasonHistoryDelta,
  TournamentAchievementTarget,
} from "../../domain/season/seasonGoalTypes";

export interface SeasonResultGoalPresentation {
  id: string;
  label: string;
  progressLabel: string;
  achieved: boolean;
}

export interface SeasonResultRankPresentation {
  startingRank: number;
  finalRank: number;
  movement: number;
}

export interface SeasonResultPresentation {
  academicYear: number;
  achievedCount: number;
  goalCount: number;
  goals: SeasonResultGoalPresentation[];
  regional: SeasonResultRankPresentation;
  national: SeasonResultRankPresentation;
  deltas: SeasonHistoryDelta;
}

function tournamentGoalLabel(achievement: TournamentAchievementTarget): string {
  if (achievement === "national-title") return "全国大会優勝";
  if (achievement === "national-appearance") return "全国大会出場";
  return "県大会優勝";
}

function goalLabel(goal: SeasonGoalResult): string {
  if (goal.kind === "regional-rank") return `県内${goal.target}位以内`;
  if (goal.kind === "official-wins") return `公式戦${goal.target}勝`;
  return tournamentGoalLabel(goal.achievement);
}

function goalProgressLabel(goal: SeasonGoalResult): string {
  if (goal.kind === "regional-rank") return `最終 ${goal.progress}位`;
  if (goal.kind === "official-wins") {
    return `${goal.progress}/${goal.target}勝`;
  }
  return goal.achieved ? "達成" : "未達成";
}

function rankPresentation(
  startingRank: number,
  finalRank: number,
): SeasonResultRankPresentation {
  return {
    startingRank,
    finalRank,
    movement: startingRank - finalRank,
  };
}

export function buildSeasonResultPresentation(
  summary: SeasonGoalSeasonSummary,
): SeasonResultPresentation {
  return {
    academicYear: summary.academicYear,
    achievedCount: summary.achievedCount,
    goalCount: summary.goalResults.length,
    goals: summary.goalResults.map((goal) => ({
      id: goal.id,
      label: goalLabel(goal),
      progressLabel: goalProgressLabel(goal),
      achieved: goal.achieved,
    })),
    regional: rankPresentation(
      summary.startingRanks.regional,
      summary.finalRanks.regional,
    ),
    national: rankPresentation(
      summary.startingRanks.national,
      summary.finalRanks.national,
    ),
    deltas: summary.deltas,
  };
}
