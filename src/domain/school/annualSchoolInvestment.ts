import type { GameState } from "../model/GameState";
import type {
  AnnualInvestmentArea,
  AnnualInvestmentLevel,
  AnnualSchoolInvestmentState,
} from "../model/SchoolManagement";
import { applySchoolFundsChange } from "./schoolEconomy";

export interface AnnualInvestmentDefinition {
  area: AnnualInvestmentArea;
  name: string;
  description: string;
  levelCosts: readonly [number, number, number];
}

export const ANNUAL_INVESTMENT_DEFINITIONS: readonly AnnualInvestmentDefinition[] =
  [
    {
      area: "development",
      name: "育成",
      description: "年間の練習効率を上げ、選手の成長を後押しします。",
      levelCosts: [250, 450, 700],
    },
    {
      area: "scouting",
      name: "スカウト",
      description: "候補発掘への投資で、上位候補に出会う確率を高めます。",
      levelCosts: [250, 450, 700],
    },
    {
      area: "medical",
      name: "メディカル",
      description: "怪我リスクを抑え、休養時のコンディション回復を高めます。",
      levelCosts: [220, 400, 650],
    },
    {
      area: "analysis",
      name: "分析",
      description:
        "試合映像とデータ分析を強化し、試合経験の学習効率を高めます。",
      levelCosts: [220, 400, 650],
    },
  ] as const;

const emptyLevels: Record<AnnualInvestmentArea, AnnualInvestmentLevel> = {
  development: 0,
  scouting: 0,
  medical: 0,
  analysis: 0,
};

const definitionByArea = new Map(
  ANNUAL_INVESTMENT_DEFINITIONS.map((definition) => [
    definition.area,
    definition,
  ]),
);

export function activeAnnualInvestments(
  state: GameState,
): AnnualSchoolInvestmentState {
  const current = state.schoolManagement.annualInvestments;
  if (current?.yearIndex === state.yearIndex) return current;
  return { yearIndex: state.yearIndex, levels: { ...emptyLevels } };
}

export interface AnnualInvestmentEffects {
  developmentGrowthPercent: number;
  scoutingAppealBonus: number;
  medicalInjuryRiskPercent: number;
  medicalRestConditionBonus: number;
  analysisDecisionGrowthBonus: number;
}

export function annualInvestmentEffects(
  state: GameState,
): AnnualInvestmentEffects {
  const levels = activeAnnualInvestments(state).levels;
  return {
    developmentGrowthPercent: [100, 104, 108, 112][levels.development]!,
    scoutingAppealBonus: [0, 4, 8, 12][levels.scouting]!,
    medicalInjuryRiskPercent: [100, 88, 76, 65][levels.medical]!,
    medicalRestConditionBonus: [0, 3, 6, 10][levels.medical]!,
    analysisDecisionGrowthBonus: [0, 1, 1, 2][levels.analysis]!,
  };
}

export type AnnualInvestmentUpgradeReason =
  "available" | "insufficient-funds" | "max-level";

export interface AnnualInvestmentUpgradeEvaluation {
  area: AnnualInvestmentArea;
  currentLevel: AnnualInvestmentLevel;
  nextLevel: AnnualInvestmentLevel;
  cost: number;
  fundsAfter: number;
  allowed: boolean;
  reason: AnnualInvestmentUpgradeReason;
}

export function evaluateAnnualInvestmentUpgrade(
  state: GameState,
  area: AnnualInvestmentArea,
): AnnualInvestmentUpgradeEvaluation {
  const school = state.schools[state.userSchoolId];
  if (!school) throw new Error("user school is missing");
  const definition = definitionByArea.get(area);
  if (!definition) throw new Error(`unknown annual investment area: ${area}`);

  const currentLevel = activeAnnualInvestments(state).levels[area];
  if (currentLevel >= 3) {
    return {
      area,
      currentLevel,
      nextLevel: 3,
      cost: 0,
      fundsAfter: school.funds,
      allowed: false,
      reason: "max-level",
    };
  }

  const nextLevel = (currentLevel + 1) as AnnualInvestmentLevel;
  const cost = definition.levelCosts[currentLevel as 0 | 1 | 2];
  const fundsAfter = school.funds - cost;
  return {
    area,
    currentLevel,
    nextLevel,
    cost,
    fundsAfter,
    allowed: fundsAfter >= 0,
    reason: fundsAfter >= 0 ? "available" : "insufficient-funds",
  };
}

export function upgradeAnnualInvestment(
  state: GameState,
  area: AnnualInvestmentArea,
): GameState {
  const evaluation = evaluateAnnualInvestmentUpgrade(state, area);
  if (!evaluation.allowed) return state;
  const definition = definitionByArea.get(area)!;
  const funded = applySchoolFundsChange(state, {
    id: `annual-investment:${state.yearIndex}:${area}:lv-${evaluation.nextLevel}`,
    kind: "annual-investment",
    amount: -evaluation.cost,
    label: `${definition.name}強化予算 Lv.${evaluation.nextLevel}`,
    relatedId: area,
  }).state;
  const current = activeAnnualInvestments(funded);

  return {
    ...funded,
    schoolManagement: {
      ...funded.schoolManagement,
      annualInvestments: {
        yearIndex: funded.yearIndex,
        levels: {
          ...current.levels,
          [area]: evaluation.nextLevel,
        },
      },
    },
  };
}
