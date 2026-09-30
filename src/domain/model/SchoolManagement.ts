import type { GameDate } from "./identifiers";

export type FundsLedgerKind =
  | "initial-funds"
  | "annual-budget"
  | "tournament-reward"
  | "season-goal-reward"
  | "event"
  | "shop-grant"
  | "facility-upgrade"
  | "assistant-coach"
  | "annual-investment"
  | "scouting-research"
  | "camp"
  | "travel";

export type AssistantCoachRank =
  "beginner" | "intermediate" | "advanced" | "master";

export type AssistantCoachSpecialty = "attack" | "defense" | "physical";

export type AnnualInvestmentKind =
  "training" | "specialist-coach" | "camp" | "scouting";

export interface AnnualInvestmentState {
  yearIndex: number;
  kinds: AnnualInvestmentKind[];
}

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
  annualInvestments?: AnnualInvestmentState;
  fundsHistory: FundsLedgerEntry[];
  lastAnnualBudgetYearIndex: number;
}
