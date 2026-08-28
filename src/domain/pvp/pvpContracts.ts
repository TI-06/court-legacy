export type PvpMatchOutcome = "win" | "loss";

export interface PvpPublishRequest {
  operationId: string;
  revision: number;
}

export interface PvpPublishedTeamSummary {
  snapshotId: string;
  schoolName: string;
  schoolShortName: string;
  reputationRank: string;
  teamPower: number;
  academicYear: number;
  publishedAt: string;
}

export interface PvpPublishResponse {
  operationId: string;
  revision: number;
  team: PvpPublishedTeamSummary;
}

export interface PvpListRequestQuery {
  cursor?: string | null;
  limit?: number;
}

export interface PvpOpponentSummary {
  snapshotId: string;
  schoolName: string;
  schoolShortName: string;
  reputationRank: string;
  teamPower: number;
  academicYear: number;
  publishedAt: string;
  rating: number;
  wins: number;
  losses: number;
  currentWinStreak: number;
}

export interface PvpOpponentsResponse {
  seasonId: string;
  opponents: PvpOpponentSummary[];
  nextCursor: string | null;
}

export interface PvpChallengeRequest {
  operationId: string;
  revision: number;
  opponentSnapshotId: string;
}

export interface PvpPublicSetResult {
  setNumber: number;
  challengerScore: number;
  defenderScore: number;
}

export interface PvpPublicMatchResult {
  outcome: PvpMatchOutcome;
  challengerSetsWon: number;
  defenderSetsWon: number;
  sets: PvpPublicSetResult[];
}

export interface PvpChallengeResponse {
  operationId: string;
  revision: number;
  seasonId: string;
  matchId: string;
  opponent: {
    snapshotId: string;
    schoolName: string;
    schoolShortName: string;
  };
  rating: {
    before: number;
    after: number;
    delta: number;
  };
  result: PvpPublicMatchResult;
  createdAt: string;
}

export interface PvpRankingEntry {
  rank: number;
  snapshotId: string;
  schoolName: string;
  schoolShortName: string;
  rating: number;
  matches: number;
  wins: number;
  losses: number;
  currentWinStreak: number;
}

export interface PvpRankingResponse {
  seasonId: string;
  ranking: PvpRankingEntry[];
  nextCursor: string | null;
}

export interface PvpHistoryEntry {
  matchId: string;
  createdAt: string;
  opponentSnapshotId: string;
  opponentSchoolName: string;
  outcome: PvpMatchOutcome;
  ratingBefore: number;
  ratingAfter: number;
  result: PvpPublicMatchResult;
}

export interface PvpHistoryResponse {
  seasonId: string;
  history: PvpHistoryEntry[];
  nextCursor: string | null;
}
