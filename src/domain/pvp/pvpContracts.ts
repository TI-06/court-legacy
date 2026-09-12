import type {
  CoachDecisionReason,
  MatchCommand,
  MatchEventType,
  MatchPhase,
} from "../model/Match";
import type { TeamSelection } from "../model/TeamSelection";
import type {
  MatchTacticPlan,
  PublicTacticSummary,
} from "../team/matchTactics";

export type PvpMatchOutcome = "win" | "loss";
export type PvpHistoryPerspective = "challenger" | "defender";

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
  tactics?: PublicTacticSummary;
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
  tactics?: PublicTacticSummary;
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
  matchSelection?: TeamSelection;
  matchTactics?: MatchTacticPlan;
}

export interface PvpPublicMatchEvent {
  sequence: number;
  type: MatchEventType;
  setNumber: number;
  challengerScore: number;
  defenderScore: number;
  winner: "challenger" | "defender" | null;
  detailCode: string;
}

export interface PvpPublicSetState {
  setNumber: number;
  challengerScore: number;
  defenderScore: number;
  completed: boolean;
  winner: "challenger" | "defender" | null;
}

export interface PvpMatchSegment {
  status: "in-progress" | "complete";
  operationId: string;
  matchId: string;
  phase: MatchPhase;
  currentSetNumber: number;
  challengerSetsWon: number;
  defenderSetsWon: number;
  currentScore: {
    challenger: number;
    defender: number;
  };
  challengerSelection: TeamSelection;
  challengerTactics: MatchTacticPlan;
  timeoutAvailable: boolean;
  sets: PvpPublicSetState[];
  pendingDecisionReason: CoachDecisionReason | null;
  events: PvpPublicMatchEvent[];
}

export interface PvpChallengeInProgressResponse {
  status: "in-progress";
  operationId: string;
  revision: number;
  seasonId: string;
  opponent: {
    snapshotId: string;
    schoolName: string;
    schoolShortName: string;
  };
  segment: PvpMatchSegment;
}

export interface PvpChallengeCommandRequest {
  operationId: string;
  commandId: string;
  command: MatchCommand;
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

export type PvpChallengeSessionResponse =
  PvpChallengeInProgressResponse | PvpChallengeResponse;

export function isPvpChallengeInProgressResponse(
  response: PvpChallengeSessionResponse,
): response is PvpChallengeInProgressResponse {
  return "status" in response && response.status === "in-progress";
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
  opponentSnapshotId: string | null;
  opponentSchoolName: string;
  perspective: PvpHistoryPerspective;
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
