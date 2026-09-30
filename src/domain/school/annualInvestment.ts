import type { GameState } from "../model/GameState";
import type { AnnualInvestmentKind } from "../model/SchoolManagement";
import { FACILITY_MAX_LEVEL } from "./facilityUpgrade";
import { applySchoolFundsChange } from "./schoolEconomy";

export interface AnnualInvestmentDefinition {
  kind: AnnualInvestmentKind;
  name: string;
  cost: number;
  description: string;
  effectLabel: string;
}

export const ANNUAL_INVESTMENT_DEFINITIONS: readonly AnnualInvestmentDefinition[] = [
  {
    kind: "training",
    name: "育成強化プログラム",
    cost: 600,
    description: "年間の練習環境へ追加投資し、通常練習の成長効率を高めます。",
    effectLabel: "通常練習の成長 +8%",
  },
  {
    kind: "specialist-coach",
    name: "専門コーチ招へい",
    cost: 700,
    description: "外部の専門指導者を定期招へいし、年間の育成効率を底上げします。",
    effectLabel: "通常練習の成長 +5%",
  },
  {
    kind: "camp",
    name: "強化合宿グレードUP",
    cost: 900,
    description: "宿泊・設備・対戦環境を強化し、実施する強化合宿の効果を高めます。",
    effectLabel: "強化合宿の成長 +20%",
  },
  {
    kind: "scouting",
    name: "全国スカウト投資",
    cost: 1000,
    description: "映像分析・遠征・情報網へ年間投資し、検索時の候補数を増やします。",
    effectLabel: "毎回の検索候補 +1人",
  },
] as const;

export function annualInvestmentsUnlocked(state: GameState): boolean {
  const school = state.schools[state.userSchoolId];
  if (!school) return false;
  return Object.values(school.facilities).every(
    (level) => level >= FACILITY_MAX_LEVEL,
  );
}

export function activeAnnualInvestments(
  state: GameState,
): readonly AnnualInvestmentKind[] {
  const investment = state.schoolManagement.annualInvestments;
  return investment?.yearIndex === state.yearIndex ? investment.kinds : [];
}

export function hasAnnualInvestment(
  state: GameState,
  kind: AnnualInvestmentKind,
): boolean {
  return activeAnnualInvestments(state).includes(kind);
}

export function purchaseAnnualInvestment(
  state: GameState,
  kind: AnnualInvestmentKind,
): GameState {
  if (!annualInvestmentsUnlocked(state)) {
    throw new Error("all facilities must reach level 50 first");
  }
  const definition = ANNUAL_INVESTMENT_DEFINITIONS.find(
    (entry) => entry.kind === kind,
  );
  if (!definition) throw new Error("unknown annual investment");
  if (hasAnnualInvestment(state, kind)) {
    throw new Error("annual investment already purchased");
  }
  const currentKinds =
    state.schoolManagement.annualInvestments?.yearIndex === state.yearIndex
      ? state.schoolManagement.annualInvestments.kinds
      : [];
  const funded = applySchoolFundsChange(state, {
    id: `annual-investment:year-${state.yearIndex}:${kind}`,
    kind: "annual-investment",
    amount: -definition.cost,
    label: definition.name,
    relatedId: kind,
  }).state;

  return {
    ...funded,
    schoolManagement: {
      ...funded.schoolManagement,
      annualInvestments: {
        yearIndex: funded.yearIndex,
        kinds: [...currentKinds, kind],
      },
    },
  };
}

export function annualTrainingGrowthPercent(state: GameState): number {
  let bonus = 0;
  if (hasAnnualInvestment(state, "training")) bonus += 8;
  if (hasAnnualInvestment(state, "specialist-coach")) bonus += 5;
  return bonus;
}

export function annualCampGrowthPercent(state: GameState): number {
  return hasAnnualInvestment(state, "camp") ? 20 : 0;
}

export function annualScoutingCandidateBonus(state: GameState): number {
  return hasAnnualInvestment(state, "scouting") ? 1 : 0;
}
