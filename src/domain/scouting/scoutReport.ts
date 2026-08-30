import type { Player, Position } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";

export type MiddleSchoolAchievement =
  | "unknown"
  | "regional-starter"
  | "prefectural-best-eight"
  | "prefectural-selection"
  | "national-event";

export type ScoutConfidence = "low" | "medium" | "high";
export type OverallScoutPrecision = "normal" | "researched";
export type PotentialScoutPrecision = "normal" | "researched" | "appraised";

export interface EstimatedRange {
  min: number;
  max: number;
}

export interface ScoutReport {
  candidateId: PlayerId;
  displayName: string;
  heightCm: number;
  position: Position;
  handedness: Player["handedness"];
  middleSchoolAchievement: MiddleSchoolAchievement;
  evaluationStars: 1 | 2 | 3 | 4 | 5;
  estimatedOverall: EstimatedRange;
  estimatedPotential: EstimatedRange;
  confidence: ScoutConfidence;
  comments: string[];
}

export interface CreateScoutReportInput {
  player: Player;
  middleSchoolAchievement: MiddleSchoolAchievement;
  observation: number;
  scoutingNetworkLevel: number;
  overallPrecision?: OverallScoutPrecision;
  potentialPrecision?: PotentialScoutPrecision;
  random: RandomSource;
}

export interface ScoutingBoardCandidate {
  player: Player;
  middleSchoolAchievement: MiddleSchoolAchievement;
}

export interface BuildScoutingBoardInput {
  candidates: readonly ScoutingBoardCandidate[];
  observation: number;
  scoutingNetworkLevel: number;
  random: RandomSource;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function overall(player: Player): number {
  const values = Object.values(player.abilities);
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function informationQuality(observation: number, scoutingNetworkLevel: number) {
  return clamp(
    clamp(observation, 0, 100) * 0.75 + clamp(scoutingNetworkLevel, 0, 5) * 5,
    0,
    100,
  );
}

function researchedQuality(quality: number): number {
  return Math.max(quality, 90);
}

function confidenceFromQuality(quality: number): ScoutConfidence {
  if (quality >= 80) {
    return "high";
  }
  if (quality >= 50) {
    return "medium";
  }
  return "low";
}

function estimatedRange(
  truth: number,
  quality: number,
  wideAtLowQuality: number,
  narrowAtHighQuality: number,
  random: RandomSource,
): EstimatedRange {
  const halfWidth = Math.round(
    wideAtLowQuality -
      (wideAtLowQuality - narrowAtHighQuality) * (quality / 100),
  );
  const noiseRadius = Math.max(1, Math.round(halfWidth * 0.55));
  const center = clamp(
    Math.round(truth) + random.int(-noiseRadius, noiseRadius),
    0,
    100,
  );

  return {
    min: Math.round(clamp(center - halfWidth, 0, 100)),
    max: Math.round(clamp(center + halfWidth, 0, 100)),
  };
}

function appraisedPotentialRange(
  truth: number,
  random: RandomSource,
): EstimatedRange {
  return estimatedRange(truth, 100, 2, 2, random);
}

function rangeMidpoint(range: EstimatedRange): number {
  return (range.min + range.max) / 2;
}

function achievementBonus(achievement: MiddleSchoolAchievement): number {
  switch (achievement) {
    case "unknown":
      return 0;
    case "regional-starter":
      return 2;
    case "prefectural-best-eight":
      return 4;
    case "prefectural-selection":
      return 7;
    case "national-event":
      return 10;
  }
}

function evaluationStars(
  estimatedOverall: EstimatedRange,
  estimatedPotential: EstimatedRange,
  achievement: MiddleSchoolAchievement,
): 1 | 2 | 3 | 4 | 5 {
  const score =
    rangeMidpoint(estimatedOverall) * 0.55 +
    rangeMidpoint(estimatedPotential) * 0.35 +
    achievementBonus(achievement);

  if (score >= 78) return 5;
  if (score >= 66) return 4;
  if (score >= 54) return 3;
  if (score >= 42) return 2;
  return 1;
}

function strongestAbilityComment(player: Player): string {
  const ranked = Object.entries(player.abilities).sort(
    (left, right) => right[1] - left[1],
  );
  const strongest = ranked[0]?.[0];

  switch (strongest) {
    case "spike":
      return "攻撃力に目を引くものがある";
    case "jump":
      return "跳躍力を生かしたプレーが目立つ";
    case "receive":
      return "レシーブの安定感が印象的";
    case "serve":
      return "サーブで流れを変える力がありそう";
    case "set":
      return "トスワークの感覚が良い";
    case "block":
      return "ネット際の守備に強みがある";
    case "speed":
      return "コート内の動き出しが速い";
    case "stamina":
      return "運動量を維持できるタイプ";
    case "decision":
      return "状況判断の良さが見える";
    case "mental":
      return "落ち着いてプレーできる";
    default:
      return "総合的にバランスの良い印象";
  }
}

function physicalComment(player: Player): string {
  if (player.heightCm >= 195) {
    return "高さは大きな武器になりそう";
  }
  if (player.heightCm <= 170) {
    return "サイズより機動力を生かすタイプ";
  }
  if (
    Object.values(player.positionAptitudes).filter((value) => value >= 60)
      .length >= 2
  ) {
    return "複数ポジションへの適応が期待できる";
  }
  return "現在のポジションで伸びしろがありそう";
}

export function createScoutReport(input: CreateScoutReportInput): ScoutReport {
  const normalQuality = informationQuality(
    input.observation,
    input.scoutingNetworkLevel,
  );
  const overallPrecision = input.overallPrecision ?? "normal";
  const potentialPrecision = input.potentialPrecision ?? "normal";
  const overallQuality =
    overallPrecision === "researched"
      ? researchedQuality(normalQuality)
      : normalQuality;
  const potentialQuality =
    potentialPrecision === "researched"
      ? researchedQuality(normalQuality)
      : normalQuality;
  const estimatedOverall = estimatedRange(
    overall(input.player),
    overallQuality,
    18,
    5,
    input.random,
  );
  const potentialTruth = input.player.potential ?? overall(input.player);
  const estimatedPotential =
    potentialPrecision === "appraised"
      ? appraisedPotentialRange(potentialTruth, input.random)
      : estimatedRange(potentialTruth, potentialQuality, 24, 7, input.random);

  return {
    candidateId: input.player.id,
    displayName: `${input.player.lastName} ${input.player.firstName}`,
    heightCm: input.player.heightCm,
    position: input.player.preferredPosition,
    handedness: input.player.handedness,
    middleSchoolAchievement: input.middleSchoolAchievement,
    evaluationStars: evaluationStars(
      estimatedOverall,
      estimatedPotential,
      input.middleSchoolAchievement,
    ),
    estimatedOverall,
    estimatedPotential,
    confidence: confidenceFromQuality(overallQuality),
    comments: [
      strongestAbilityComment(input.player),
      physicalComment(input.player),
    ],
  };
}

export function buildScoutingBoard(
  input: BuildScoutingBoardInput,
): ScoutReport[] {
  return input.candidates.map((candidate) =>
    createScoutReport({
      player: candidate.player,
      middleSchoolAchievement: candidate.middleSchoolAchievement,
      observation: input.observation,
      scoutingNetworkLevel: input.scoutingNetworkLevel,
      random: input.random,
    }),
  );
}
