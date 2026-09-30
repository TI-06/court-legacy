import type { GameState } from "../model/GameState";
import type { Player } from "../model/Player";
import type {
  AnnualInvestmentArea,
  AnnualInvestmentLevel,
  AnnualInvestmentPlan,
  AssistantCoachSpecialty,
} from "../model/SchoolManagement";
import type { RecruitTierProbabilities } from "../scouting/recruitmentTierProbability";
import type { AdditionalGrowthModifier } from "../training/calculateGrowth";
import { applySchoolFundsChange } from "./schoolEconomy";

export type AnnualInvestmentReason =
  | "available"
  | "insufficient-funds"
  | "max-level"
  | "specialist-focus-required"
  | "specialist-focus-locked";

export interface AnnualInvestmentDefinition {
  area: AnnualInvestmentArea;
  name: string;
  description: string;
  stepCosts: readonly [number, number, number];
}

export interface AnnualInvestmentEvaluation {
  allowed: boolean;
  reason: AnnualInvestmentReason;
  area: AnnualInvestmentArea;
  currentLevel: AnnualInvestmentLevel;
  nextLevel: AnnualInvestmentLevel;
  cost: number;
  fundsAfter: number;
  specialistFocus: AssistantCoachSpecialty | null;
}

export const ANNUAL_INVESTMENT_DEFINITIONS: readonly AnnualInvestmentDefinition[] = [
  {
    area: "training",
    name: "育成支援",
    description: "通常練習の成長効率を年度中ずっと底上げします。",
    stepCosts: [180, 320, 500],
  },
  {
    area: "specialist",
    name: "専門コーチ招へい",
    description: "攻撃・守備・フィジカルから選んだ専門分野の育成を強化します。",
    stepCosts: [250, 400, 650],
  },
  {
    area: "camp",
    name: "合宿強化",
    description: "強化合宿で得られる能力成長を底上げします。",
    stepCosts: [180, 320, 500],
  },
  {
    area: "scouting",
    name: "スカウト投資",
    description: "有望・上位ランク候補を発見しやすくします。",
    stepCosts: [220, 380, 600],
  },
] as const;

const specialistAbilities: Record<
  AssistantCoachSpecialty,
  readonly (keyof Player["abilities"])[]
> = {
  attack: ["spike", "serve", "set"],
  defense: ["receive", "block"],
  physical: ["speed", "jump", "stamina"],
};

const trainingPercentByLevel: Record<AnnualInvestmentLevel, number> = {
  0: 100,
  1: 103,
  2: 106,
  3: 110,
};

const specialistPercentByLevel: Record<AnnualInvestmentLevel, number> = {
  0: 100,
  1: 104,
  2: 108,
  3: 112,
};

const campPercentByLevel: Record<AnnualInvestmentLevel, number> = {
  0: 100,
  1: 110,
  2: 120,
  3: 130,
};

const scoutingBonusByLevel: Record<
  AnnualInvestmentLevel,
  Omit<RecruitTierProbabilities, "normal">
> = {
  0: { promising: 0, elite: 0, generational: 0, monster: 0 },
  1: { promising: 120, elite: 40, generational: 4, monster: 1 },
  2: { promising: 200, elite: 80, generational: 8, monster: 2 },
  3: { promising: 300, elite: 130, generational: 15, monster: 5 },
};

function definition(area: AnnualInvestmentArea): AnnualInvestmentDefinition {
  const found = ANNUAL_INVESTMENT_DEFINITIONS.find(
    (candidate) => candidate.area === area,
  );
  if (!found) throw new Error(`unknown annual investment area: ${area}`);
  return found;
}

function levelForArea(
  plan: AnnualInvestmentPlan,
  area: AnnualInvestmentArea,
): AnnualInvestmentLevel {
  switch (area) {
    case "training":
      return plan.trainingLevel;
    case "specialist":
      return plan.specialistLevel;
    case "camp":
      return plan.campLevel;
    case "scouting":
      return plan.scoutingLevel;
  }
}

function setLevelForArea(
  plan: AnnualInvestmentPlan,
  area: AnnualInvestmentArea,
  level: AnnualInvestmentLevel,
): AnnualInvestmentPlan {
  switch (area) {
    case "training":
      return { ...plan, trainingLevel: level };
    case "specialist":
      return { ...plan, specialistLevel: level };
    case "camp":
      return { ...plan, campLevel: level };
    case "scouting":
      return { ...plan, scoutingLevel: level };
  }
}

export function createAnnualInvestmentPlan(
  yearIndex: number,
): AnnualInvestmentPlan {
  return {
    yearIndex,
    trainingLevel: 0,
    specialistLevel: 0,
    campLevel: 0,
    scoutingLevel: 0,
    specialistFocus: null,
  };
}

export function currentAnnualInvestmentPlan(
  state: Pick<GameState, "yearIndex" | "schoolManagement">,
): AnnualInvestmentPlan {
  const current = state.schoolManagement.annualInvestment;
  return current?.yearIndex === state.yearIndex
    ? current
    : createAnnualInvestmentPlan(state.yearIndex);
}

export function annualInvestmentEffectLabel(
  area: AnnualInvestmentArea,
  level: AnnualInvestmentLevel,
): string {
  if (level === 0) return "未投資";
  switch (area) {
    case "training":
      return `通常練習 +${trainingPercentByLevel[level] - 100}%`;
    case "specialist":
      return `専門育成 +${specialistPercentByLevel[level] - 100}%`;
    case "camp":
      return `合宿成長 +${campPercentByLevel[level] - 100}%`;
    case "scouting": {
      const bonus = scoutingBonusByLevel[level];
      return `上位候補発見 +${Math.round(
        (bonus.promising + bonus.elite + bonus.generational + bonus.monster) /
          100,
      )}%相当`;
    }
  }
}

export function evaluateAnnualInvestment(
  state: GameState,
  area: AnnualInvestmentArea,
  specialistFocus: AssistantCoachSpecialty | null = null,
): AnnualInvestmentEvaluation {
  const school = state.schools[state.userSchoolId];
  if (!school) throw new Error("user school is missing");
  const plan = currentAnnualInvestmentPlan(state);
  const currentLevel = levelForArea(plan, area);
  if (currentLevel >= 3) {
    return {
      allowed: false,
      reason: "max-level",
      area,
      currentLevel,
      nextLevel: 3,
      cost: 0,
      fundsAfter: school.funds,
      specialistFocus: plan.specialistFocus,
    };
  }

  const requestedFocus =
    area === "specialist"
      ? plan.specialistFocus ?? specialistFocus
      : plan.specialistFocus;
  if (area === "specialist" && !requestedFocus) {
    return {
      allowed: false,
      reason: "specialist-focus-required",
      area,
      currentLevel,
      nextLevel: (currentLevel + 1) as AnnualInvestmentLevel,
      cost: definition(area).stepCosts[currentLevel],
      fundsAfter: school.funds,
      specialistFocus: null,
    };
  }
  if (
    area === "specialist" &&
    plan.specialistFocus &&
    specialistFocus &&
    plan.specialistFocus !== specialistFocus
  ) {
    return {
      allowed: false,
      reason: "specialist-focus-locked",
      area,
      currentLevel,
      nextLevel: (currentLevel + 1) as AnnualInvestmentLevel,
      cost: definition(area).stepCosts[currentLevel],
      fundsAfter: school.funds,
      specialistFocus: plan.specialistFocus,
    };
  }

  const cost = definition(area).stepCosts[currentLevel];
  const fundsAfter = school.funds - cost;
  return {
    allowed: fundsAfter >= 0,
    reason: fundsAfter >= 0 ? "available" : "insufficient-funds",
    area,
    currentLevel,
    nextLevel: (currentLevel + 1) as AnnualInvestmentLevel,
    cost,
    fundsAfter,
    specialistFocus: requestedFocus,
  };
}

export function investAnnualProgram(
  state: GameState,
  area: AnnualInvestmentArea,
  specialistFocus: AssistantCoachSpecialty | null = null,
): GameState {
  const evaluation = evaluateAnnualInvestment(state, area, specialistFocus);
  if (!evaluation.allowed) return state;
  const plan = currentAnnualInvestmentPlan(state);
  const nextPlan = setLevelForArea(plan, area, evaluation.nextLevel);
  const withFocus =
    area === "specialist"
      ? { ...nextPlan, specialistFocus: evaluation.specialistFocus }
      : nextPlan;
  const funded = applySchoolFundsChange(state, {
    id: `annual-investment:year-${state.yearIndex}:${area}:lv-${evaluation.nextLevel}`,
    kind: "annual-investment",
    amount: -evaluation.cost,
    label: `${definition(area).name} Lv.${evaluation.nextLevel}`,
    relatedId: area,
  }).state;

  return {
    ...funded,
    schoolManagement: {
      ...funded.schoolManagement,
      annualInvestment: withFocus,
    },
  };
}

export function annualInvestmentTrainingModifiers(
  state: GameState,
  targetAbilities: readonly (keyof Player["abilities"])[],
): AdditionalGrowthModifier[] {
  const plan = currentAnnualInvestmentPlan(state);
  const modifiers: AdditionalGrowthModifier[] = [];
  const trainingPercent = trainingPercentByLevel[plan.trainingLevel];
  if (trainingPercent > 100) {
    modifiers.push({
      code: "annual-investment-training",
      label: "年間育成支援",
      percent: trainingPercent,
    });
  }

  if (plan.specialistFocus && plan.specialistLevel > 0) {
    const focusedAbilities = specialistAbilities[plan.specialistFocus];
    if (targetAbilities.some((ability) => focusedAbilities.includes(ability))) {
      modifiers.push({
        code: "annual-investment-specialist",
        label: "専門コーチ招へい",
        percent: specialistPercentByLevel[plan.specialistLevel],
      });
    }
  }

  return modifiers;
}

export function annualTrainingCampGrowthModifiers(
  state: GameState,
): AdditionalGrowthModifier[] {
  const plan = currentAnnualInvestmentPlan(state);
  const percent = campPercentByLevel[plan.campLevel];
  return percent > 100
    ? [
        {
          code: "annual-investment-camp",
          label: "合宿強化予算",
          percent,
        },
      ]
    : [];
}

export function applyAnnualScoutingInvestment(
  probabilities: RecruitTierProbabilities,
  state: GameState,
): RecruitTierProbabilities {
  const plan = currentAnnualInvestmentPlan(state);
  const bonus = scoutingBonusByLevel[plan.scoutingLevel];
  const totalBonus =
    bonus.promising + bonus.elite + bonus.generational + bonus.monster;
  if (totalBonus <= 0) return probabilities;
  const appliedBonus = Math.min(totalBonus, probabilities.normal);
  if (appliedBonus <= 0) return probabilities;
  const ratio = appliedBonus / totalBonus;

  const promising = Math.round(bonus.promising * ratio);
  const elite = Math.round(bonus.elite * ratio);
  const generational = Math.round(bonus.generational * ratio);
  const monster = Math.max(0, appliedBonus - promising - elite - generational);

  return {
    normal: probabilities.normal - appliedBonus,
    promising: probabilities.promising + promising,
    elite: probabilities.elite + elite,
    generational: probabilities.generational + generational,
    monster: probabilities.monster + monster,
  };
}
