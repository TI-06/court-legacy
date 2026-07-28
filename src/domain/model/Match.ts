import type { MatchId, PlayerId, SchoolId } from "./identifiers";
import type { TeamSelection } from "./TeamSelection";

export type MatchPhase =
  | "pre-match"
  | "set-in-progress"
  | "coach-decision"
  | "set-complete"
  | "match-complete";

export type CoachCommand =
  | { type: "timeout" }
  | {
      type: "substitute";
      outgoingPlayerId: PlayerId;
      incomingPlayerId: PlayerId;
    }
  | { type: "serve-target"; targetPlayerId: PlayerId | null }
  | { type: "attack-focus"; position: "OH" | "MB" | "OP" | "S" }
  | { type: "block-system"; system: "read" | "commit" | "mixed" }
  | { type: "defense-bias"; bias: "cross" | "balanced" | "line" }
  | { type: "encourage"; playerId: PlayerId | null };

export type MatchEventType =
  | "serve"
  | "receive"
  | "set"
  | "attack"
  | "block"
  | "dig"
  | "point"
  | "rotation"
  | "substitution"
  | "timeout"
  | "injury"
  | "set-end"
  | "match-end";

export interface MatchEvent {
  sequence: number;
  type: MatchEventType;
  setNumber: number;
  homeScore: number;
  awayScore: number;
  actorPlayerId: PlayerId | null;
  targetPlayerId: PlayerId | null;
  winnerSchoolId: SchoolId | null;
  detailCode: string;
}

export interface MatchSetState {
  setNumber: number;
  homeScore: number;
  awayScore: number;
  completed: boolean;
  winnerSchoolId: SchoolId | null;
}

export interface MatchState {
  id: MatchId;
  homeSchoolId: SchoolId;
  awaySchoolId: SchoolId;
  homeSelection: TeamSelection;
  awaySelection: TeamSelection;
  bestOfSets: 3 | 5;
  phase: MatchPhase;
  currentSetNumber: number;
  homeSetsWon: number;
  awaySetsWon: number;
  sets: MatchSetState[];
  servingSchoolId: SchoolId;
  pendingCoachCommandForSchoolId: SchoolId | null;
  eventLog: MatchEvent[];
  randomSeed: string;
  randomCursor: number;
}

export interface MatchAnalysisFactor {
  code: string;
  impact: number;
  title: string;
  detail: string;
}

export interface MatchAnalysis {
  matchId: MatchId;
  winnerSchoolId: SchoolId;
  principalFactors: MatchAnalysisFactor[];
  recommendations: MatchAnalysisFactor[];
}
