import type { GameState } from "../model/GameState";
import type { SchoolFacilities } from "../model/School";
import type { SchoolId } from "../model/identifiers";
import { applySchoolFundsChange } from "./schoolEconomy";

export type FacilityKey = keyof SchoolFacilities;
export type FacilityUpgradeLevels = 1 | 5 | 10;

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

export const FACILITY_MAX_LEVEL = 50;
export const FACILITY_UPGRADE_LEVEL_OPTIONS = [
  1, 5, 10,
] as const satisfies readonly FacilityUpgradeLevels[];

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

function isFacilityUpgradeLevels(
  value: number,
): value is FacilityUpgradeLevels {
  return FACILITY_UPGRADE_LEVEL_OPTIONS.some((option) => option === value);
}

export function calculateFacilityUpgradeCost(
  key: FacilityKey,
  currentLevel: number,
): number {
  const definition = getDefinition(key);
  if (
    !Number.isInteger(currentLevel) ||
    currentLevel < 0 ||
    currentLevel > FACILITY_MAX_LEVEL
  ) {
    throw new Error(`invalid facility level: ${currentLevel}`);
  }

  const multiplier =
    currentLevel < 20
      ? 1 + currentLevel * 0.045
      : currentLevel < 40
        ? 1 + 20 * 0.045 + (currentLevel - 20) * 0.06
        : 1 + 20 * 0.045 + 20 * 0.06 + (currentLevel - 40) * 0.09;
  return Math.round(definition.baseCost * multiplier);
}

export function calculateFacilityUpgradeTotalCost(
  key: FacilityKey,
  currentLevel: number,
  levels: FacilityUpgradeLevels,
): number {
  if (!isFacilityUpgradeLevels(levels)) {
    throw new Error(`invalid facility upgrade levels: ${levels}`);
  }
  if (
    !Number.isInteger(currentLevel) ||
    currentLevel < 0 ||
    currentLevel >= FACILITY_MAX_LEVEL ||
    currentLevel + levels > FACILITY_MAX_LEVEL
  ) {
    throw new Error(
      `invalid facility upgrade range: ${currentLevel} + ${levels}`,
    );
  }

  let total = 0;
  for (let offset = 0; offset < levels; offset += 1) {
    total += calculateFacilityUpgradeCost(key, currentLevel + offset);
  }
  return total;
}

export function evaluateFacilityUpgrade(
  state: GameState,
  schoolId: SchoolId,
  key: FacilityKey,
  levels: FacilityUpgradeLevels = 1,
): FacilityUpgradeEvaluation {
  getDefinition(key);
  const school = state.schools[schoolId];
  if (!school) {
    throw new Error(`unknown school: ${schoolId}`);
  }

  const currentLevel = school.facilities[key];
  if (
    !Number.isInteger(currentLevel) ||
    currentLevel < 0 ||
    currentLevel > FACILITY_MAX_LEVEL ||
    !isFacilityUpgradeLevels(levels)
  ) {
    return {
      allowed: false,
      reason: "invalid-level",
      currentLevel,
      nextLevel: currentLevel,
      cost: 0,
      fundsAfter: school.funds,
    };
  }

  const nextLevel = currentLevel + levels;
  if (currentLevel === FACILITY_MAX_LEVEL || nextLevel > FACILITY_MAX_LEVEL) {
    return {
      allowed: false,
      reason: "max-level",
      currentLevel,
      nextLevel: Math.min(nextLevel, FACILITY_MAX_LEVEL),
      cost: 0,
      fundsAfter: school.funds,
    };
  }

  const cost = calculateFacilityUpgradeTotalCost(key, currentLevel, levels);
  const fundsAfter = school.funds - cost;
  const allowed = fundsAfter >= 0;

  return {
    allowed,
    reason: allowed ? "available" : "insufficient-funds",
    currentLevel,
    nextLevel,
    cost,
    fundsAfter,
  };
}

export function upgradeFacility(
  state: GameState,
  schoolId: SchoolId,
  key: FacilityKey,
  levels: FacilityUpgradeLevels = 1,
): GameState {
  const evaluation = evaluateFacilityUpgrade(state, schoolId, key, levels);
  if (!evaluation.allowed) {
    return state;
  }

  const funded = applySchoolFundsChange(state, {
    id: `facility:${schoolId}:${key}:lv-${evaluation.currentLevel}-to-${evaluation.nextLevel}`,
    kind: "facility-upgrade",
    amount: -evaluation.cost,
    label: `${getDefinition(key).name} Lv.${evaluation.currentLevel}→${evaluation.nextLevel}強化`,
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
