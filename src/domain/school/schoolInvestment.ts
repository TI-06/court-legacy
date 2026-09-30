import type { GameState } from "../model/GameState";
import type { Player } from "../model/Player";
import type { AdditionalGrowthModifier } from "../training/calculateGrowth";
import { applySchoolFundsChange } from "./schoolEconomy";

export type DevelopmentInvestmentFocus = "attack" | "defense" | "physical";
export type ExternalSpecialist = "attacker" | "setter" | "blocker" | "libero";
export type CampInvestmentTier = "intensive" | "elite";
export type ScoutingInvestmentTier = "regional" | "national";
export type SchoolInvestmentCategory =
  "development" | "external-coach" | "camp" | "scouting";
export type SchoolInvestmentOption =
  | DevelopmentInvestmentFocus
  | ExternalSpecialist
  | CampInvestmentTier
  | ScoutingInvestmentTier;

export interface SchoolInvestmentPlan {
  yearIndex: number;
  developmentFocus?: DevelopmentInvestmentFocus;
  externalSpecialist?: ExternalSpecialist;
  campTier?: CampInvestmentTier;
  scoutingTier?: ScoutingInvestmentTier;
}

export const SCHOOL_INVESTMENT_COSTS = {
  development: 350,
  "external-coach": 500,
  camp: { intensive: 300, elite: 700 },
  scouting: { regional: 300, national: 650 },
} as const;

const developmentAbilities: Record<
  DevelopmentInvestmentFocus,
  readonly (keyof Player["abilities"])[]
> = {
  attack: ["spike", "serve", "set"],
  defense: ["receive", "block", "decision"],
  physical: ["jump", "speed", "stamina"],
};

const specialistPositions: Record<
  ExternalSpecialist,
  readonly Player["preferredPosition"][]
> = {
  attacker: ["OH", "OP"],
  setter: ["S"],
  blocker: ["MB"],
  libero: ["L"],
};

const specialistAbilities: Record<
  ExternalSpecialist,
  readonly (keyof Player["abilities"])[]
> = {
  attacker: ["spike", "serve", "jump"],
  setter: ["set", "decision", "serve"],
  blocker: ["block", "jump", "speed"],
  libero: ["receive", "speed", "decision"],
};

export function activeSchoolInvestmentPlan(
  state: GameState,
): SchoolInvestmentPlan | null {
  const plan = state.schoolManagement.investmentPlan;
  return plan?.yearIndex === state.yearIndex ? plan : null;
}

function categoryAlreadySelected(
  plan: SchoolInvestmentPlan | null,
  category: SchoolInvestmentCategory,
): boolean {
  if (!plan) return false;
  if (category === "development") return plan.developmentFocus !== undefined;
  if (category === "external-coach")
    return plan.externalSpecialist !== undefined;
  if (category === "camp") return plan.campTier !== undefined;
  return plan.scoutingTier !== undefined;
}

function optionCost(
  category: SchoolInvestmentCategory,
  option: SchoolInvestmentOption,
): number {
  if (category === "development") {
    if (!["attack", "defense", "physical"].includes(option))
      throw new Error("invalid development investment option");
    return SCHOOL_INVESTMENT_COSTS.development;
  }
  if (category === "external-coach") {
    if (!["attacker", "setter", "blocker", "libero"].includes(option))
      throw new Error("invalid external coach investment option");
    return SCHOOL_INVESTMENT_COSTS["external-coach"];
  }
  if (category === "camp") {
    if (option !== "intensive" && option !== "elite")
      throw new Error("invalid camp investment option");
    return SCHOOL_INVESTMENT_COSTS.camp[option];
  }
  if (option !== "regional" && option !== "national")
    throw new Error("invalid scouting investment option");
  return SCHOOL_INVESTMENT_COSTS.scouting[option];
}

export function evaluateSchoolInvestment(
  state: GameState,
  category: SchoolInvestmentCategory,
  option: SchoolInvestmentOption,
) {
  const school = state.schools[state.userSchoolId];
  if (!school) throw new Error("user school is missing");
  const cost = optionCost(category, option);
  const plan = activeSchoolInvestmentPlan(state);
  const alreadySelected = categoryAlreadySelected(plan, category);
  return {
    allowed: !alreadySelected && school.funds >= cost,
    reason: alreadySelected
      ? ("already-selected" as const)
      : school.funds < cost
        ? ("insufficient-funds" as const)
        : ("available" as const),
    cost,
    fundsAfter: school.funds - cost,
  };
}

export function purchaseSchoolInvestment(
  state: GameState,
  category: SchoolInvestmentCategory,
  option: SchoolInvestmentOption,
): GameState {
  const evaluation = evaluateSchoolInvestment(state, category, option);
  if (!evaluation.allowed) return state;

  const current =
    activeSchoolInvestmentPlan(state) ??
    ({ yearIndex: state.yearIndex } as SchoolInvestmentPlan);
  const next: SchoolInvestmentPlan = { ...current };
  if (category === "development") {
    if (!["attack", "defense", "physical"].includes(option))
      throw new Error("invalid development investment option");
    next.developmentFocus = option as DevelopmentInvestmentFocus;
  } else if (category === "external-coach") {
    if (!["attacker", "setter", "blocker", "libero"].includes(option))
      throw new Error("invalid external coach investment option");
    next.externalSpecialist = option as ExternalSpecialist;
  } else if (category === "camp") {
    next.campTier = option as CampInvestmentTier;
  } else {
    next.scoutingTier = option as ScoutingInvestmentTier;
  }

  const funded = applySchoolFundsChange(state, {
    id: `school-investment:${state.yearIndex}:${category}`,
    kind: "school-investment",
    amount: -evaluation.cost,
    label:
      category === "development"
        ? "年間強化予算"
        : category === "external-coach"
          ? "外部専門コーチ"
          : category === "camp"
            ? "強化合宿予算"
            : "スカウト遠征予算",
    relatedId: `${category}:${option}`,
  }).state;

  return {
    ...funded,
    schoolManagement: {
      ...funded.schoolManagement,
      investmentPlan: next,
    },
  };
}

export function schoolInvestmentTrainingModifiers(
  state: GameState,
  player: Player,
  targetAbilities: readonly (keyof Player["abilities"])[],
): AdditionalGrowthModifier[] {
  const plan = activeSchoolInvestmentPlan(state);
  if (!plan) return [];
  const modifiers: AdditionalGrowthModifier[] = [];

  if (
    plan.developmentFocus &&
    targetAbilities.some((ability) =>
      developmentAbilities[plan.developmentFocus!].includes(ability),
    )
  ) {
    modifiers.push({
      code: "school-development-investment",
      label: "年間強化予算",
      percent: 110,
    });
  }

  if (
    plan.externalSpecialist &&
    specialistPositions[plan.externalSpecialist].includes(
      player.preferredPosition,
    ) &&
    targetAbilities.some((ability) =>
      specialistAbilities[plan.externalSpecialist!].includes(ability),
    )
  ) {
    modifiers.push({
      code: "external-specialist-coach",
      label: "外部専門コーチ",
      percent: 115,
    });
  }

  return modifiers;
}

export function trainingCampInvestmentModifier(state: GameState): {
  growthPercent: number;
  specialAbilityBonus: number;
} {
  const tier = activeSchoolInvestmentPlan(state)?.campTier;
  if (tier === "elite") return { growthPercent: 125, specialAbilityBonus: 12 };
  if (tier === "intensive")
    return { growthPercent: 112, specialAbilityBonus: 6 };
  return { growthPercent: 100, specialAbilityBonus: 0 };
}

export function scoutingInvestmentAppealBonus(state: GameState): number {
  const tier = activeSchoolInvestmentPlan(state)?.scoutingTier;
  if (tier === "national") return 12;
  if (tier === "regional") return 6;
  return 0;
}
