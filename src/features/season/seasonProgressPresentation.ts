import type { GameState } from "../../domain/model/GameState";
import type { SchoolId } from "../../domain/model/identifiers";
import {
  buildSchoolRankings,
  type SchoolRankingRow,
} from "../../domain/season/schoolRankings";
import type {
  SeasonGoalResult,
  TournamentAchievementTarget,
} from "../../domain/season/seasonGoalTypes";
import { evaluateSeasonGoals } from "../../domain/season/seasonGoals";

export interface SeasonProgressGoalPresentation {
  id: string;
  label: string;
  progressLabel: string;
  achieved: boolean;
}

export interface SeasonNearbySchoolPresentation {
  rank: number;
  schoolId: SchoolId;
  displayName: string;
  shortName: string;
  reputationPoints: number;
  isUserSchool: boolean;
}

export interface SeasonRankingPresentation {
  rank: number;
  total: number;
  startingRank: number;
  movement: number;
  nearby: SeasonNearbySchoolPresentation[];
}

export interface SeasonProgressPresentation {
  academicYear: number;
  achievedCount: number;
  goalCount: number;
  goals: SeasonProgressGoalPresentation[];
  regional: SeasonRankingPresentation;
  national: SeasonRankingPresentation;
}

function tournamentGoalLabel(
  achievement: TournamentAchievementTarget,
): string {
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
  if (goal.kind === "regional-rank") return `現在 ${goal.progress}位`;
  if (goal.kind === "official-wins") {
    return `${goal.progress}/${goal.target}勝`;
  }
  return goal.achieved ? "達成" : "未達成";
}

function nearbyRows(
  rankings: readonly SchoolRankingRow[],
  userSchoolId: SchoolId,
): SeasonNearbySchoolPresentation[] {
  const userIndex = rankings.findIndex((row) => row.schoolId === userSchoolId);
  if (userIndex < 0) {
    throw new Error(`user school is missing from ranking: ${userSchoolId}`);
  }

  const size = Math.min(5, rankings.length);
  const start = Math.max(
    0,
    Math.min(userIndex - Math.floor(size / 2), rankings.length - size),
  );

  return rankings.slice(start, start + size).map((row) => ({
    rank: row.rank,
    schoolId: row.schoolId,
    displayName: row.displayName,
    shortName: row.shortName,
    reputationPoints: row.reputationPoints,
    isUserSchool: row.schoolId === userSchoolId,
  }));
}

function rankingPresentation(
  rankings: readonly SchoolRankingRow[],
  userSchoolId: SchoolId,
  currentRank: number,
  startingRank: number,
): SeasonRankingPresentation {
  return {
    rank: currentRank,
    total: rankings.length,
    startingRank,
    movement: startingRank - currentRank,
    nearby: nearbyRows(rankings, userSchoolId),
  };
}

export function buildSeasonProgressPresentation(
  state: GameState,
): SeasonProgressPresentation | null {
  const seasonGoals = state.seasonGoals;
  if (!seasonGoals) return null;

  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error(`user school not found: ${state.userSchoolId}`);
  }

  const summary = evaluateSeasonGoals(state, seasonGoals);
  const regionalRankings = buildSchoolRankings(state, {
    regionId: school.regionId,
  });
  const nationalRankings = buildSchoolRankings(state);

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
    regional: rankingPresentation(
      regionalRankings,
      state.userSchoolId,
      summary.finalRanks.regional,
      summary.startingRanks.regional,
    ),
    national: rankingPresentation(
      nationalRankings,
      state.userSchoolId,
      summary.finalRanks.national,
      summary.startingRanks.national,
    ),
  };
}
