import type { GameState } from "../model/GameState";
import type { School } from "../model/School";
import { schoolRankingSnapshot } from "./schoolRankings";
import type {
  SeasonGoalDefinition,
  SeasonGoalSeasonSummary,
  SeasonGoalState,
  SeasonHistoryBaseline,
  SeasonHistoryDelta,
  TournamentAchievementTarget,
} from "./seasonGoalTypes";

type SeasonGoalSource = Pick<
  GameState,
  "yearIndex" | "calendar" | "schools" | "userSchoolId"
>;

function historyBaseline(school: School): SeasonHistoryBaseline {
  return {
    officialWins: school.history.officialWins,
    prefecturalTitles: school.history.prefecturalTitles,
    nationalAppearances: school.history.nationalAppearances,
    nationalTitles: school.history.nationalTitles,
  };
}

function officialWinTarget(reputationPoints: number): number {
  if (reputationPoints >= 1000) return 7;
  if (reputationPoints >= 800) return 6;
  if (reputationPoints >= 600) return 5;
  if (reputationPoints >= 400) return 4;
  if (reputationPoints >= 200) return 3;
  return 2;
}

function tournamentTarget(
  reputationPoints: number,
): TournamentAchievementTarget {
  if (reputationPoints >= 800) return "national-title";
  if (reputationPoints >= 400) return "national-appearance";
  return "prefectural-title";
}

function regionalRankTarget(startRank: number, total: number): number {
  const improvement = Math.max(1, Math.ceil(total * 0.15));
  return Math.max(1, startRank - improvement);
}

export function createSeasonGoals(state: SeasonGoalSource): SeasonGoalState {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error("user school is missing while creating season goals");
  }
  const ranking = schoolRankingSnapshot(state, school.id);
  const achievement = tournamentTarget(school.reputationPoints);
  const goals: SeasonGoalDefinition[] = [
    {
      id: `season:${state.yearIndex}:regional-rank`,
      kind: "regional-rank",
      target: regionalRankTarget(ranking.regional.rank, ranking.regional.total),
    },
    {
      id: `season:${state.yearIndex}:official-wins`,
      kind: "official-wins",
      target: officialWinTarget(school.reputationPoints),
    },
    {
      id: `season:${state.yearIndex}:tournament-achievement`,
      kind: "tournament-achievement",
      target: 1,
      achievement,
    },
  ];

  return {
    yearIndex: state.yearIndex,
    academicYear: state.calendar.academicYear,
    startingRanks: {
      regional: ranking.regional.rank,
      national: ranking.national.rank,
    },
    rankingTotals: {
      regional: ranking.regional.total,
      national: ranking.national.total,
    },
    baseline: historyBaseline(school),
    goals,
  };
}

function nonNegativeDelta(current: number, baseline: number): number {
  return Math.max(0, current - baseline);
}

function historyDelta(
  school: School,
  baseline: SeasonHistoryBaseline,
): SeasonHistoryDelta {
  return {
    officialWins: nonNegativeDelta(
      school.history.officialWins,
      baseline.officialWins,
    ),
    prefecturalTitles: nonNegativeDelta(
      school.history.prefecturalTitles,
      baseline.prefecturalTitles,
    ),
    nationalAppearances: nonNegativeDelta(
      school.history.nationalAppearances,
      baseline.nationalAppearances,
    ),
    nationalTitles: nonNegativeDelta(
      school.history.nationalTitles,
      baseline.nationalTitles,
    ),
  };
}

function tournamentProgress(
  achievement: TournamentAchievementTarget | undefined,
  deltas: SeasonHistoryDelta,
): number {
  if (achievement === "national-title") return deltas.nationalTitles;
  if (achievement === "national-appearance") return deltas.nationalAppearances;
  return deltas.prefecturalTitles;
}

export function evaluateSeasonGoals(
  state: SeasonGoalSource,
  seasonGoals: SeasonGoalState,
): SeasonGoalSeasonSummary {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error("user school is missing while evaluating season goals");
  }
  if (seasonGoals.yearIndex !== state.yearIndex) {
    throw new Error("season goals do not belong to the current academic year");
  }
  const ranking = schoolRankingSnapshot(state, school.id);
  const deltas = historyDelta(school, seasonGoals.baseline);
  const goalResults = seasonGoals.goals.map((goal) => {
    const progress =
      goal.kind === "regional-rank"
        ? ranking.regional.rank
        : goal.kind === "official-wins"
          ? deltas.officialWins
          : tournamentProgress(goal.achievement, deltas);
    const achieved =
      goal.kind === "regional-rank"
        ? progress <= goal.target
        : progress >= goal.target;
    return { ...goal, progress, achieved };
  });

  return {
    yearIndex: seasonGoals.yearIndex,
    academicYear: seasonGoals.academicYear,
    startingRanks: { ...seasonGoals.startingRanks },
    finalRanks: {
      regional: ranking.regional.rank,
      national: ranking.national.rank,
    },
    deltas,
    goalResults,
    achievedCount: goalResults.filter((goal) => goal.achieved).length,
  };
}
