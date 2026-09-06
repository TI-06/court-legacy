import type { GameState } from "../model/GameState";
import type { SchoolFacilities } from "../model/School";
import type { SchoolId } from "../model/identifiers";
import { applySchoolFundsChange } from "./schoolEconomy";

export type FacilityKey = keyof SchoolFacilities;

export interface FacilityDefinition {
  key: FacilityKey;
  name: string;
  baseCost: number;
  description: string;
}

export type FacilityUpgradeReason =
  "available" | "insufficient-funds" | "max-level" | "invalid-level";

export interface FacilityUpgradeEvaluation {
  allowed: boolean;
  reason: FacilityUpgradeReason;
  currentLevel: number;
  nextLevel: number;
  cost: number;
  fundsAfter: number;
}

export const FACILITY_DEFINITIONS: readonly FacilityDefinition[] = [
  {
    key: "gym",
    name: "体育館",
    baseCost: 80,
    description: "練習環境の土台となる体育館を整備します。",
  },
  {
    key: "trainingRoom",
    name: "トレーニング設備",
    baseCost: 70,
    description: "週間練習で得られる能力成長を高めます。",
  },
  {
    key: "analysisRoom",
    name: "分析室",
    baseCost: 55,
    description: "対戦相手と試合内容を分析する環境を整えます。",
  },
  {
    key: "recoveryRoom",
    name: "回復設備",
    baseCost: 60,
    description: "疲労回復を早め、練習中の怪我リスクを抑えます。",
  },
  {
    key: "dormitory",
    name: "寮",
    baseCost: 90,
    description: "選手が生活と競技に集中できる環境を整えます。",
  },
  {
    key: "scoutingNetwork",
    name: "スカウト網",
    baseCost: 75,
    description: "将来の新入生候補を見つけるための基盤です。",
  },
  {
    key: "alumniAssociation",
    name: "OB会",
    baseCost: 50,
    description: "卒業生とのつながりを強め、学校を支援します。",
  },
  {
    key: "studyRoom",
    name: "学習設備",
    baseCost: 45,
    description: "学業と部活動を両立するための環境を整えます。",
  },
] as const;

const definitionByKey = new Map(
  FACILITY_DEFINITIONS.map((definition) => [definition.key, definition]),
);

function getDefinition(key: FacilityKey): FacilityDefinition {
  const definition = definitionByKey.get(key);
  if (!definition) {
    throw new Error(`unknown facility: ${String(key)}`);
  }
  return definition;
}

export function calculateFacilityUpgradeCost(
  key: FacilityKey,
  currentLevel: number,
): number {
  const definition = getDefinition(key);
  if (!Number.isInteger(currentLevel) || currentLevel < 0) {
    throw new Error(`invalid facility level: ${currentLevel}`);
  }
  return definition.baseCost * (currentLevel + 1);
}

export function evaluateFacilityUpgrade(
  state: GameState,
  schoolId: SchoolId,
  key: FacilityKey,
): FacilityUpgradeEvaluation {
  getDefinition(key);
  const school = state.schools[schoolId];
  if (!school) {
    throw new Error(`unknown school: ${schoolId}`);
  }

  const currentLevel = school.facilities[key];
  if (!Number.isInteger(currentLevel) || currentLevel < 0 || currentLevel > 5) {
    return {
      allowed: false,
      reason: "invalid-level",
      currentLevel,
      nextLevel: currentLevel,
      cost: 0,
      fundsAfter: school.funds,
    };
  }

  if (currentLevel === 5) {
    return {
      allowed: false,
      reason: "max-level",
      currentLevel,
      nextLevel: 5,
      cost: calculateFacilityUpgradeCost(key, currentLevel),
      fundsAfter: school.funds,
    };
  }

  const cost = calculateFacilityUpgradeCost(key, currentLevel);
  const fundsAfter = school.funds - cost;
  const allowed = fundsAfter >= 0;

  return {
    allowed,
    reason: allowed ? "available" : "insufficient-funds",
    currentLevel,
    nextLevel: currentLevel + 1,
    cost,
    fundsAfter,
  };
}

export function upgradeFacility(
  state: GameState,
  schoolId: SchoolId,
  key: FacilityKey,
): GameState {
  const evaluation = evaluateFacilityUpgrade(state, schoolId, key);
  if (!evaluation.allowed) {
    return state;
  }

  const funded = applySchoolFundsChange(state, {
    id: `facility:${schoolId}:${key}:lv-${evaluation.nextLevel}`,
    kind: "facility-upgrade",
    amount: -evaluation.cost,
    label: `${getDefinition(key).name} Lv.${evaluation.nextLevel}強化`,
    relatedId: key,
  }).state;
  const school = funded.schools[schoolId]!;
  return {
    ...funded,
    schools: {
      ...funded.schools,
      [schoolId]: {
        ...school,
        facilities: {
          ...school.facilities,
          [key]: evaluation.nextLevel,
        },
      },
    },
  };
}
