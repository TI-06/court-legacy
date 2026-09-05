import type { GameState } from "../model/GameState";
import type {
  FundsLedgerEntry,
  FundsLedgerKind,
  SchoolManagementState,
} from "../model/SchoolManagement";
import type { SchoolReputation } from "../model/School";
import type { GameDate } from "../model/identifiers";

export const MAX_FUNDS_HISTORY = 50;

const ANNUAL_BUDGETS: Record<SchoolReputation, number> = {
  unknown: 400,
  "district-contender": 500,
  "prefectural-power": 650,
  "national-qualifier": 850,
  "national-regular": 1100,
  elite: 1400,
};

export interface SchoolFundsChangeInput {
  id: string;
  kind: FundsLedgerKind;
  amount: number;
  label: string;
  relatedId?: string;
  allowPartialDebit?: boolean;
}

export interface SchoolFundsChangeResult {
  state: GameState;
  appliedAmount: number;
}

export function annualSchoolBudget(reputation: SchoolReputation): number {
  return ANNUAL_BUDGETS[reputation];
}

export function alumniAnnualBudgetBonus(level: number): number {
  if (!Number.isInteger(level) || level < 0 || level > 50) {
    throw new Error("invalid alumni association level");
  }
  return level * 8 + (level >= 20 ? 100 : 0) + (level >= 50 ? 300 : 0);
}

export function applySchoolFundsChange(
  state: GameState,
  input: SchoolFundsChangeInput,
): SchoolFundsChangeResult {
  if (!Number.isSafeInteger(input.amount) || input.amount === 0) {
    throw new Error("funds change must be a non-zero safe integer");
  }
  const school = state.schools[state.userSchoolId];
  if (!school) throw new Error("user school is missing");

  const requestedBalance = school.funds + input.amount;
  if (requestedBalance < 0 && !input.allowPartialDebit) {
    throw new Error("insufficient school funds");
  }
  const appliedAmount =
    requestedBalance < 0 ? -school.funds : input.amount;
  if (appliedAmount === 0) return { state, appliedAmount: 0 };
  const balanceAfter = school.funds + appliedAmount;
  const entry: FundsLedgerEntry = {
    id: input.id,
    gameDate: state.date,
    academicYearIndex: state.yearIndex,
    kind: input.kind,
    amount: appliedAmount,
    balanceAfter,
    label: input.label,
    ...(input.relatedId ? { relatedId: input.relatedId } : {}),
  };

  return {
    appliedAmount,
    state: {
      ...state,
      schools: {
        ...state.schools,
        [school.id]: { ...school, funds: balanceAfter },
      },
      schoolManagement: {
        ...state.schoolManagement,
        fundsHistory: [...state.schoolManagement.fundsHistory, entry].slice(
          -MAX_FUNDS_HISTORY,
        ),
      },
    },
  };
}

export function createInitialSchoolManagement(input: {
  gameDate: GameDate;
  academicYearIndex: number;
  initialFunds: number;
  annualBudget: number;
}): SchoolManagementState {
  return {
    assistantCoach: null,
    lastAnnualBudgetYearIndex: input.academicYearIndex,
    fundsHistory: [
      {
        id: `initial-funds:year-${input.academicYearIndex}`,
        gameDate: input.gameDate,
        academicYearIndex: input.academicYearIndex,
        kind: "initial-funds",
        amount: input.initialFunds,
        balanceAfter: input.initialFunds,
        label: "初期活動資金",
      },
      {
        id: `annual-budget:year-${input.academicYearIndex}`,
        gameDate: input.gameDate,
        academicYearIndex: input.academicYearIndex,
        kind: "annual-budget",
        amount: input.annualBudget,
        balanceAfter: input.initialFunds + input.annualBudget,
        label: "初年度学校予算",
      },
    ],
  };
}
