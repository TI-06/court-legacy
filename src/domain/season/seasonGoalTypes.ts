export type SeasonGoalKind =
  "regional-rank" | "official-wins" | "tournament-achievement";

export type TournamentAchievementTarget =
  "prefectural-title" | "national-appearance" | "national-title";

export interface SeasonGoalDefinition {
  id: string;
  kind: SeasonGoalKind;
  target: number;
  achievement?: TournamentAchievementTarget;
}

export interface SeasonHistoryBaseline {
  officialWins: number;
  prefecturalTitles: number;
  nationalAppearances: number;
  nationalTitles: number;
}

interface SeasonRanks {
  regional: number;
  national: number;
}

export interface SeasonGoalState {
  yearIndex: number;
  academicYear: number;
  startingRanks: SeasonRanks;
  rankingTotals: SeasonRanks;
  baseline: SeasonHistoryBaseline;
  goals: SeasonGoalDefinition[];
}

export interface SeasonGoalResult extends SeasonGoalDefinition {
  progress: number;
  achieved: boolean;
}

export interface SeasonHistoryDelta {
  officialWins: number;
  prefecturalTitles: number;
  nationalAppearances: number;
  nationalTitles: number;
}

export interface SeasonGoalSeasonSummary {
  yearIndex: number;
  academicYear: number;
  startingRanks: SeasonRanks;
  finalRanks: SeasonRanks;
  deltas: SeasonHistoryDelta;
  goalResults: SeasonGoalResult[];
  achievedCount: number;
}
