import type { Player } from "../model/Player";
import type { School } from "../model/School";
import type {
  GrowthTypeDefinition,
  PersonalityDefinition,
} from "../validation/gameDataSchema";

export type GrowthModifierCode =
  | "grade"
  | "growth-type"
  | "personality"
  | "facility"
  | "coach"
  | "fatigue"
  | "condition"
  | "academic";

export interface GrowthModifier {
  code: GrowthModifierCode;
  label: string;
  percent: number;
}

export interface GrowthCalculationInput {
  baseGrowth: number;
  player: Player;
  school: School;
  growthType: GrowthTypeDefinition;
  personality: PersonalityDefinition;
}

export interface GrowthCalculationResult {
  amount: number;
  modifiers: GrowthModifier[];
  academicRestricted: boolean;
}

function clampPercent(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function gradeMultiplier(
  player: Player,
  growthType: GrowthTypeDefinition,
): number {
  switch (player.grade) {
    case 1:
      return growthType.gradeMultipliers.grade1;
    case 2:
      return growthType.gradeMultipliers.grade2;
    case 3:
      return growthType.gradeMultipliers.grade3;
  }
}

function academicMultiplier(academic: number): number {
  if (academic < 30) {
    return 50;
  }
  if (academic < 40) {
    return 75;
  }
  return 100;
}

export function calculateGrowth(
  input: GrowthCalculationInput,
): GrowthCalculationResult {
  if (!Number.isFinite(input.baseGrowth) || input.baseGrowth < 0) {
    throw new Error("base growth must be a non-negative finite number");
  }

  const grade = gradeMultiplier(input.player, input.growthType);
  const growthType = input.growthType.practiceMultiplier;
  const personality = clampPercent(
    100 + input.personality.trainingStability,
    75,
    125,
  );
  const facility = clampPercent(
    100 + input.school.facilities.trainingRoom * 8,
    100,
    140,
  );
  const coach = clampPercent(
    80 + input.school.coach.development * 0.4,
    80,
    120,
  );
  const fatigue = clampPercent(100 - input.player.fatigue * 0.6, 40, 100);
  const condition = clampPercent(75 + input.player.condition * 0.25, 60, 100);
  const academic = academicMultiplier(input.player.academic);
  const modifiers: GrowthModifier[] = [
    { code: "grade", label: "学年成長", percent: grade },
    { code: "growth-type", label: "成長タイプ", percent: growthType },
    { code: "personality", label: "性格安定", percent: personality },
    { code: "facility", label: "練習設備", percent: facility },
    { code: "coach", label: "監督育成力", percent: coach },
    { code: "fatigue", label: "疲労", percent: fatigue },
    { code: "condition", label: "コンディション", percent: condition },
    { code: "academic", label: "学業参加制限", percent: academic },
  ];
  const combinedMultiplier = modifiers.reduce(
    (product, modifier) => product * (modifier.percent / 100),
    1,
  );
  const amount = Math.max(
    0,
    Math.round((input.baseGrowth * combinedMultiplier) / 4),
  );

  return {
    amount,
    modifiers,
    academicRestricted: academic < 100,
  };
}
