import type { GameState } from "../model/GameState";
import type { School } from "../model/School";
import { schoolRankingSnapshot } from "./schoolRankings";
import type {
  SeasonAmbition,
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

export const seasonAmbitionLabels: Record<SeasonAmbition, string> = {
  steady: "安定",
  challenge: "挑戦",
  bold: "野心",
};

export const seasonAmbitionDescriptions: Record<SeasonAmbition, string> = {
  steady: "達成しやすい目標で着実に資金を積み上げる",
  challenge: "現在の学校評価に合った標準的な目標",
  bold: "一段上の目標へ挑み、より大きな報酬を狙う",
};

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

function ambitionWinTarget(
  baseTarget: number,
  ambition: SeasonAmbition,
): number {
  if (ambition === "steady") return Math.max(1, baseTarget - 1);
  if (ambition === "bold") return Math.min(8, baseTarget + 1);
  return baseTarget;
}

function ambitionTournamentTarget(
  baseTarget: TournamentAchievementTarget,
  ambition: SeasonAmbition,
): TournamentAchievementTarget {
  if (ambition === "steady") {
    if (baseTarget === "national-title") return "national-appearance";
    return "prefectural-title";
  }
  if (ambition === "bold") {
    if (baseTarget === "prefectural-title") return "national-appearance";
    return "national-title";
  }
  return baseTarget;
}

function regionalRankTarget(
  startRank: number,
  total: number,
  ambition: SeasonAmbition,
): number {
  const rate = ambition === "steady" ? 0.1 : ambition === "bold" ? 0.2 : 0.15;
  const improvement = Math.max(1, Math.ceil(total * rate));
  return Math.max(1, startRank - improvement);
}

function buildGoals(input: {
  yearIndex: number;
  startRegionalRank: number;
  regionalTotal: number;
  reputationPoints: number;
  ambition: SeasonAmbition;
}): SeasonGoalDefinition[] {
  const baseWins = officialWinTarget(input.reputationPoints);
  const baseTournament = tournamentTarget(input.reputationPoints);
  return [
    {
      id: `season:${input.yearIndex}:regional-rank`,
      kind: "regional-rank",
      target: regionalRankTarget(
        input.startRegionalRank,
        input.regionalTotal,
        input.ambition,
      ),
    },
    {
      id: `season:${input.yearIndex}:official-wins`,
      kind: "official-wins",
      target: ambitionWinTarget(baseWins, input.ambition),
    },
    {
      id: `season:${input.yearIndex}:tournament-achievement`,
      kind: "tournament-achievement",
      target: 1,
      achievement: ambitionTournamentTarget(baseTournament, input.ambition),
    },
  ];
}

export function createSeasonGoals(
  state: SeasonGoalSource,
  options: {
    ambition?: SeasonAmbition;
    ambitionSelectionPending?: boolean;
  } = {},
): SeasonGoalState {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error("user school is missing while creating season goals");
  }
  const ranking = schoolRankingSnapshot(state, school.id);
  const ambition = options.ambition ?? "challenge";
  const goals = buildGoals({
    yearIndex: state.yearIndex,
    startRegionalRank: ranking.regional.rank,
    regionalTotal: ranking.regional.total,
    reputationPoints: school.reputationPoints,
    ambition,
  });

  return {
    yearIndex: state.yearIndex,
    ambition,
    ambitionSelectionPending: options.ambitionSelectionPending ?? false,
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
  const regionalBaselineComparable =
    seasonGoals.rankingTotals.regional === ranking.regional.total;
  const nationalBaselineComparable =
    seasonGoals.rankingTotals.national === ranking.national.total;
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
    ambition: seasonGoals.ambition ?? "challenge",
    academicYear: seasonGoals.academicYear,
    startingRanks: {
      regional: regionalBaselineComparable
        ? seasonGoals.startingRanks.regional
        : ranking.regional.rank,
      national: nationalBaselineComparable
        ? seasonGoals.startingRanks.national
        : ranking.national.rank,
    },
    finalRanks: {
      regional: ranking.regional.rank,
      national: ranking.national.rank,
    },
    deltas,
    goalResults,
    achievedCount: goalResults.filter((goal) => goal.achieved).length,
  };
}


export class SeasonAmbitionSelectionError extends Error {
  constructor(public readonly reason: "unavailable" | "locked") {
    super(
      reason === "locked"
        ? "今シーズンの目標方針はすでに確定しています"
        : "シーズン目標を変更できません",
    );
    this.name = "SeasonAmbitionSelectionError";
  }
}

export function previewSeasonAmbition(
  state: GameState,
  ambition: SeasonAmbition,
): SeasonGoalState {
  const current = state.seasonGoals;
  if (!current || current.yearIndex !== state.yearIndex) {
    throw new SeasonAmbitionSelectionError("unavailable");
  }
  const school = state.schools[state.userSchoolId];
  if (!school) throw new SeasonAmbitionSelectionError("unavailable");

  return {
    ...current,
    ambition,
    goals: buildGoals({
      yearIndex: current.yearIndex,
      startRegionalRank: current.startingRanks.regional,
      regionalTotal: current.rankingTotals.regional,
      reputationPoints: school.reputationPoints,
      ambition,
    }),
  };
}

export function selectSeasonAmbition(
  state: GameState,
  ambition: SeasonAmbition,
): GameState {
  const current = state.seasonGoals;
  if (!current || current.yearIndex !== state.yearIndex) {
    throw new SeasonAmbitionSelectionError("unavailable");
  }
  if (
    current.ambitionSelectionPending !== true ||
    state.calendar.weekOfYear !== 1 ||
    state.calendar.completedActivityIds.some((id) =>
      id.startsWith(`week:${state.date}:`),
    )
  ) {
    throw new SeasonAmbitionSelectionError("locked");
  }

  return {
    ...state,
    seasonGoals: {
      ...previewSeasonAmbition(state, ambition),
      ambitionSelectionPending: false,
    },
  };
}
