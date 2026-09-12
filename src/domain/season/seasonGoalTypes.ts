export type SeasonGoalKind =
  | "regional-rank"
  | "official-wins"
  | "tournament-achievement";

export type TournamentAchievementTarget =
  | "prefectural-title"
  | "national-appearance"
  | "national-title";

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

export interface SeasonGoalState {
  yearIndex: number;
  academicYear: number;
  startingRanks: {
    regional: number;
    national: number;
  };
  rankingTotals: {
    regional: number;
    national: number;
  };
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
  startingRanks: SeasonGoalState["startingRanks"];
  finalRanks: SeasonGoalState["startingRanks"];
  deltas: SeasonHistoryDelta;
  goalResults: SeasonGoalResult[];
  achievedCount: number;
}
