import type { PlayerTier } from "../model/Player";
import type { RandomSource } from "../random/SeededRandom";

export type RecruitTier = Exclude<PlayerTier, "prospect">;

export interface RecruitmentTierProbabilityInput {
  reputationPoints: number;
  coachScouting: number;
  scoutingNetworkLevel: number;
  dormitoryLevel: number;
  recentSeasonRating: number;
}

export interface RecruitTierProbabilities {
  normal: number;
  promising: number;
  elite: number;
  generational: number;
  monster: number;
}

const BASIS_POINTS = 10_000;
const MAX_REPUTATION_POINTS = 1400;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizedPercentage(value: number, maximum: number): number {
  return (clamp(value, 0, maximum) / maximum) * 100;
}

function recruitmentAppeal(input: RecruitmentTierProbabilityInput): number {
  const reputation = normalizedPercentage(
    input.reputationPoints,
    MAX_REPUTATION_POINTS,
  );
  const coachScouting = clamp(input.coachScouting, 0, 100);
  const scoutingNetwork = normalizedPercentage(input.scoutingNetworkLevel, 5);
  const dormitory = normalizedPercentage(input.dormitoryLevel, 5);
  const recentSeason = clamp(input.recentSeasonRating, 0, 100);

  return clamp(
    reputation * 0.6 +
      coachScouting * 0.15 +
      scoutingNetwork * 0.15 +
      dormitory * 0.05 +
      recentSeason * 0.05,
    0,
    100,
  );
}

function interpolate(
  minimum: number,
  maximum: number,
  percentage: number,
): number {
  return Math.round(minimum + (maximum - minimum) * (percentage / 100));
}

export function calculateRecruitTierProbabilities(
  input: RecruitmentTierProbabilityInput,
): RecruitTierProbabilities {
  const appeal = recruitmentAppeal(input);
  const promising = interpolate(1500, 3200, appeal);
  const elite = interpolate(100, 1100, appeal);
  const generational = interpolate(2, 35, appeal);
  const monster = interpolate(1, 10, appeal);
  const normal = BASIS_POINTS - promising - elite - generational - monster;

  return {
    normal,
    promising,
    elite,
    generational,
    monster,
  };
}

export function selectRecruitTier(
  probabilities: RecruitTierProbabilities,
  random: RandomSource,
): RecruitTier {
  const roll = random.int(1, BASIS_POINTS);
  const tiers: readonly RecruitTier[] = [
    "normal",
    "promising",
    "elite",
    "generational",
    "monster",
  ];
  let cumulative = 0;

  for (const tier of tiers) {
    cumulative += probabilities[tier];
    if (roll <= cumulative) {
      return tier;
    }
  }

  return "normal";
}
