import type { Player } from "../../src/domain/model/Player";
import type { School } from "../../src/domain/model/School";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";

export type PvpOperationKind = "publish" | "challenge";
export type PvpMatchOutcome = "win" | "loss";

export interface PublishedPvpTeamSnapshot {
  id: string;
  userId: string;
  sourceRevision: number;
  sourceAcademicYear: number;
  sourceYearIndex: number;
  school: School;
  players: Record<string, Player>;
  teamSelection: TeamSelection;
  isActive: boolean;
  publishedAt: string;
}

export interface PublishPvpSnapshotInput {
  userId: string;
  operationId: string;
  sourceRevision: number;
  sourceAcademicYear: number;
  sourceYearIndex: number;
  school: School;
  players: Record<string, Player>;
  teamSelection: TeamSelection;
  reputationRank: string;
  teamPower: number;
}

export interface PersistedPvpOperation {
  userId: string;
  operationId: string;
  kind: PvpOperationKind;
  response: unknown;
}

export interface CommitRatedPvpMatchInput {
  seasonId: string;
  challengeDayKey: string;
  operationId: string;
  challengerUserId: string;
  defenderUserId: string;
  defenderSnapshotId: string;
  challengerSourceRevision: number;
  matchSeed: string;
  challengerWon: boolean;
  result: unknown;
}

export interface CommittedRatedPvpMatch {
  matchId: string;
  seasonId: string;
  operationId: string;
  challengerUserId: string;
  defenderUserId: string;
  defenderSnapshotId: string;
  winnerUserId: string;
  challengerRatingBefore: number;
  challengerRatingAfter: number;
  defenderRatingBefore: number;
  defenderRatingAfter: number;
  result: unknown;
  createdAt: string;
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

export interface PvpHistoryEntry {
  matchId: string;
  createdAt: string;
  opponentSnapshotId: string;
  opponentSchoolName: string;
  outcome: PvpMatchOutcome;
  ratingBefore: number;
  ratingAfter: number;
  result: unknown;
}

export interface PvpListQuery {
  seasonId: string;
  limit: number;
  cursor: string | null;
}

export interface PvpOpponentQuery extends PvpListQuery {
  userId: string;
}

export interface PvpHistoryQuery extends PvpListQuery {
  userId: string;
}

export interface PvPStore {
  publishSnapshot(
    input: PublishPvpSnapshotInput,
  ): Promise<PublishedPvpTeamSnapshot>;
  findChallengeOperation(
    userId: string,
    operationId: string,
  ): Promise<PersistedPvpOperation | null>;
  getSnapshotById(snapshotId: string): Promise<PublishedPvpTeamSnapshot | null>;
  commitRatedMatch(
    input: CommitRatedPvpMatchInput,
  ): Promise<CommittedRatedPvpMatch>;
  listOpponents(input: PvpOpponentQuery): Promise<PvpOpponentSummary[]>;
  listRanking(input: PvpListQuery): Promise<PvpRankingEntry[]>;
  listHistory(input: PvpHistoryQuery): Promise<PvpHistoryEntry[]>;
}