import type { GameDate } from "./identifiers";

export type FundsLedgerKind =
  | "initial-funds"
  | "annual-budget"
  | "tournament-reward"
  | "event"
  | "shop-grant"
  | "facility-upgrade"
  | "assistant-coach"
  | "scouting-research"
  | "camp"
  | "travel";

export type AssistantCoachRank =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "master";

export type AssistantCoachSpecialty = "attack" | "defense" | "physical";

export interface AssistantCoachContract {
  rank: AssistantCoachRank;
  specialty: AssistantCoachSpecialty | null;
  contractYearIndex: number;
}

export interface FundsLedgerEntry {
  id: string;
  gameDate: GameDate;
  academicYearIndex: number;
  kind: FundsLedgerKind;
  amount: number;
  balanceAfter: number;
  label: string;
  relatedId?: string;
}

export interface SchoolManagementState {
  assistantCoach: AssistantCoachContract | null;
  fundsHistory: FundsLedgerEntry[];
  lastAnnualBudgetYearIndex: number;
}
