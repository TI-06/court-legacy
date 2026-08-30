import type {
  TournamentCircuit,
  TournamentLevel,
  TournamentRound,
} from "../tournament/tournamentTypes";
import type { WeeklyPlan } from "../training/resolveWeeklyTraining";
import type { AbilityKey } from "../validation/gameDataSchema";
import type { GameDate, PlayerId, SchoolId } from "../model/identifiers";

export type AutoRestReason = "injury" | "fatigue" | "condition";

export type PracticeMatchCandidateTier = "same" | "stronger" | "challenge";
export type PracticeMatchCandidateStatus = "available" | "rejected" | "accepted";

export type PracticeRating = 1 | 2 | 3 | 4 | 5;

export interface PracticeMatchOffer {
  schoolId: SchoolId;
  growthRating: PracticeRating;
  loadRating: PracticeRating;
}

export interface PracticeMatchCandidate {
  schoolId: SchoolId;
  tier: PracticeMatchCandidateTier;
  acceptancePercent: number;
  growthRating: PracticeRating;
  status: PracticeMatchCandidateStatus;
}

export interface PracticeMatchHistoryEntry {
  opponentSchoolId: SchoolId;
  date: GameDate;
}

export interface WeeklyTrainingGrowthSummary {
  playerId: PlayerId;
  totalAbilityGrowth: number;
  abilityChanges: Partial<Record<AbilityKey, number>>;
}

export interface WeeklyRestRecoverySummary {
  playerId: PlayerId;
  reason: AutoRestReason;
  fatigueBefore: number;
  fatigueAfter: number;
  conditionBefore: number;
  conditionAfter: number;
}

export interface WeeklyReportMatchSummary {
  kind: "practice" | "official";
  opponentDisplayName: string;
  homeSetsWon: number;
  awaySetsWon: number;
  won: boolean;
  circuit: TournamentCircuit | null;
  level: TournamentLevel | null;
  round: TournamentRound | null;
}

export interface WeeklyReport {
  weekStartDate: GameDate;
  weekEndDate: GameDate;
  trainingMenuId: string;
  trainingGrowth: WeeklyTrainingGrowthSummary[];
  restRecoveries: WeeklyRestRecoverySummary[];
  injuredPlayerIds: PlayerId[];
  healedPlayerIds: PlayerId[];
  match: WeeklyReportMatchSummary | null;
  practiceMatchSkippedReason: "insufficient-players" | null;
  cohesionDelta: number;
  reputationDelta: number;
  nextIncomingOfferSchoolId: SchoolId | null;
}

export interface WeeklyScheduleState {
  trainingPlan: WeeklyPlan;
  practiceMatch: {
    incomingOffer: PracticeMatchOffer | null;
    outgoingCandidates: PracticeMatchCandidate[];
    scheduledOpponentId: SchoolId | null;
    scheduledBy: "incoming" | "outgoing" | null;
  };
  recentPracticeMatches: PracticeMatchHistoryEntry[];
  latestReport: WeeklyReport | null;
}
