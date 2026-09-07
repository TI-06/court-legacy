import type { GameState } from "../model/GameState";
import type { Player } from "../model/Player";
import type {
  AssistantCoachRank,
  AssistantCoachSpecialty,
} from "../model/SchoolManagement";
import type { AdditionalGrowthModifier } from "../training/calculateGrowth";
import { applySchoolFundsChange } from "./schoolEconomy";

export interface AssistantCoachOption {
  rank: AssistantCoachRank;
  name: string;
  annualCost: number;
  generalPercent: number;
  specialtyPercent: number | null;
  conditionPercent: number | null;
  firstYearPercent: number | null;
}

export type AssistantCoachContractReason =
  | "available"
  | "insufficient-funds"
  | "specialty-required"
  | "specialty-not-allowed";

export interface AssistantCoachContractEvaluation {
  allowed: boolean;
  reason: AssistantCoachContractReason;
  cost: number;
  fundsAfter: number;
}

export const ASSISTANT_COACH_OPTIONS: readonly AssistantCoachOption[] = [
  {
    rank: "beginner",
    name: "初級コーチ",
    annualCost: 80,
    generalPercent: 105,
    specialtyPercent: null,
    conditionPercent: null,
    firstYearPercent: null,
  },
  {
    rank: "intermediate",
    name: "中級コーチ",
    annualCost: 200,
    generalPercent: 108,
    specialtyPercent: 114,
    conditionPercent: null,
    firstYearPercent: null,
  },
  {
    rank: "advanced",
    name: "上級コーチ",
    annualCost: 450,
    generalPercent: 112,
    specialtyPercent: 122,
    conditionPercent: 104,
    firstYearPercent: null,
  },
  {
    rank: "master",
    name: "マスターコーチ",
    annualCost: 900,
    generalPercent: 118,
    specialtyPercent: 130,
    conditionPercent: 108,
    firstYearPercent: 105,
  },
] as const;

const optionByRank = new Map(
  ASSISTANT_COACH_OPTIONS.map((option) => [option.rank, option]),
);

const specialtyAbilities: Record<
  AssistantCoachSpecialty,
  readonly (keyof Player["abilities"])[]
> = {
  attack: ["spike", "serve", "set"],
  defense: ["receive", "block"],
  physical: ["speed", "jump", "stamina"],
};

export function assistantCoachOption(
  rank: AssistantCoachRank,
): AssistantCoachOption {
  const option = optionByRank.get(rank);
  if (!option) throw new Error(`unknown assistant coach rank: ${rank}`);
  return option;
}

export function evaluateAssistantCoachContract(
  state: GameState,
  rank: AssistantCoachRank,
  specialty: AssistantCoachSpecialty | null,
): AssistantCoachContractEvaluation {
  const option = assistantCoachOption(rank);
  const school = state.schools[state.userSchoolId];
  if (!school) throw new Error("user school is missing");

  if (rank === "beginner" && specialty !== null) {
    return {
      allowed: false,
      reason: "specialty-not-allowed",
      cost: option.annualCost,
      fundsAfter: school.funds - option.annualCost,
    };
  }
  if (rank !== "beginner" && specialty === null) {
    return {
      allowed: false,
      reason: "specialty-required",
      cost: option.annualCost,
      fundsAfter: school.funds - option.annualCost,
    };
  }

  const fundsAfter = school.funds - option.annualCost;
  return {
    allowed: fundsAfter >= 0,
    reason: fundsAfter >= 0 ? "available" : "insufficient-funds",
    cost: option.annualCost,
    fundsAfter,
  };
}

export function contractAssistantCoach(
  state: GameState,
  rank: AssistantCoachRank,
  specialty: AssistantCoachSpecialty | null,
): GameState {
  const evaluation = evaluateAssistantCoachContract(state, rank, specialty);
  if (!evaluation.allowed) return state;
  const option = assistantCoachOption(rank);
  const funded = applySchoolFundsChange(state, {
    id: `assistant-coach:${state.yearIndex}:${rank}:${specialty ?? "general"}:${state.schoolManagement.fundsHistory.length}`,
    kind: "assistant-coach",
    amount: -evaluation.cost,
    label: `${option.name} 年間契約`,
    relatedId: `${rank}:${specialty ?? "general"}`,
  }).state;

  return {
    ...funded,
    schoolManagement: {
      ...funded.schoolManagement,
      assistantCoach: {
        rank,
        specialty,
        contractYearIndex: state.yearIndex,
      },
    },
  };
}

export function assistantCoachTrainingModifiers(
  state: GameState,
  player: Player,
  targetAbilities: readonly (keyof Player["abilities"])[],
): AdditionalGrowthModifier[] {
  const contract = state.schoolManagement.assistantCoach;
  if (!contract || contract.contractYearIndex !== state.yearIndex) return [];

  const option = assistantCoachOption(contract.rank);
  const modifiers: AdditionalGrowthModifier[] = [
    {
      code: "assistant-coach",
      label: option.name,
      percent: option.generalPercent,
    },
  ];

  if (contract.specialty && option.specialtyPercent) {
    const abilities = specialtyAbilities[contract.specialty];
    if (targetAbilities.some((ability) => abilities.includes(ability))) {
      modifiers.push({
        code: "assistant-coach-specialty",
        label: `${option.name}・専門指導`,
        percent: option.specialtyPercent,
      });
    }
  }

  if (player.condition < 60 && option.conditionPercent) {
    modifiers.push({
      code: "assistant-coach-condition",
      label: `${option.name}・低調子ケア`,
      percent: option.conditionPercent,
    });
  }
  if (player.grade === 1 && option.firstYearPercent) {
    modifiers.push({
      code: "assistant-coach-first-year",
      label: `${option.name}・1年生育成`,
      percent: option.firstYearPercent,
    });
  }

  return modifiers;
}
