import type { SchoolReputation } from "../model/School";

export type ReputationGrade = "E" | "D" | "C" | "B" | "A" | "S" | "SS";

export interface ReputationSeasonInput {
  currentPoints: number;
  recentSeasonRatings: readonly number[];
  officialWins: number;
  officialLosses: number;
  prefecturalTitles: number;
  nationalAppearances: number;
  nationalTitles: number;
}

export interface ReputationSeasonResult {
  points: number;
  seasonRating: number;
  recentSeasonRatings: number[];
}

const MAX_REPUTATION_POINTS = 1400;
const RECENT_SEASON_WINDOW = 5;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function boundedCount(value: number, maximum: number): number {
  return clamp(Math.floor(value), 0, maximum);
}

export function reputationGrade(points: number): ReputationGrade {
  if (points >= 1200) return "SS";
  if (points >= 1000) return "S";
  if (points >= 800) return "A";
  if (points >= 600) return "B";
  if (points >= 400) return "C";
  if (points >= 200) return "D";
  return "E";
}

export function legacyReputationFromPoints(
  points: number,
): SchoolReputation {
  if (points >= 850) return "elite";
  if (points >= 620) return "national-regular";
  if (points >= 400) return "national-qualifier";
  if (points >= 220) return "prefectural-power";
  if (points >= 80) return "district-contender";
  return "unknown";
}

function seasonRating(input: ReputationSeasonInput): number {
  const officialWins = Math.max(0, input.officialWins);
  const officialLosses = Math.max(0, input.officialLosses);
  const officialMatches = officialWins + officialLosses;
  const baseline =
    officialMatches > 0
      ? (officialWins / officialMatches) * 60
      : clamp(input.currentPoints / 14, 0, 100);
  const achievementBonus =
    boundedCount(input.prefecturalTitles, 2) * 10 +
    boundedCount(input.nationalAppearances, 2) * 8 +
    boundedCount(input.nationalTitles, 2) * 12;

  return Math.round(clamp(baseline + achievementBonus, 0, 100));
}

export function resolveSeasonReputation(
  input: ReputationSeasonInput,
): ReputationSeasonResult {
  const rating = seasonRating(input);
  const recentSeasonRatings = [
    ...input.recentSeasonRatings.map((value) =>
      Math.round(clamp(value, 0, 100)),
    ),
    rating,
  ].slice(-RECENT_SEASON_WINDOW);
  const recentAverage =
    recentSeasonRatings.reduce((total, value) => total + value, 0) /
    recentSeasonRatings.length;
  const longTermPoints = clamp(
    input.currentPoints,
    0,
    MAX_REPUTATION_POINTS,
  );
  const shortTermTarget = recentAverage * 14;
  const points = Math.round(
    clamp(
      longTermPoints * 0.85 + shortTermTarget * 0.15,
      0,
      MAX_REPUTATION_POINTS,
    ),
  );

  return {
    points,
    seasonRating: rating,
    recentSeasonRatings,
  };
}
