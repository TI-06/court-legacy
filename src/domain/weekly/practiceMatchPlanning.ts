import type { GameState } from "../model/GameState";
import type { School } from "../model/School";
import { calculateTournamentSchoolStrength } from "../tournament/createOfficialSeason";
import type {
  PracticeMatchCandidate,
  PracticeMatchCandidateTier,
  PracticeMatchHistoryEntry,
  PracticeMatchOffer,
  PracticeRating,
} from "./weeklyScheduleTypes";

export type PracticePlanningSource = Pick<
  GameState,
  | "seed"
  | "randomCursor"
  | "date"
  | "calendar"
  | "userSchoolId"
  | "schools"
  | "players"
  | "officialSeason"
>;

export interface PracticePlanningResult {
  incomingOffer: PracticeMatchOffer | null;
  outgoingCandidates: PracticeMatchCandidate[];
}

interface RankedOpponent {
  school: School;
  strength: number;
  ratio: number;
}

function practiceRating(ratio: number): PracticeRating {
  if (ratio <= 0.85) return 1;
  if (ratio <= 0.95) return 2;
  if (ratio <= 1.05) return 3;
  if (ratio <= 1.15) return 4;
  return 5;
}

function tierTarget(tier: PracticeMatchCandidateTier): number {
  if (tier === "same") return 1;
  if (tier === "stronger") return 1.075;
  return 1.15;
}

function tierMatches(tier: PracticeMatchCandidateTier, ratio: number): boolean {
  if (tier === "same") return ratio >= 0.85 && ratio <= 1;
  if (tier === "stronger") return ratio > 1 && ratio <= 1.15;
  return ratio > 1.15;
}

function selectTierOpponent(
  opponents: readonly RankedOpponent[],
  tier: PracticeMatchCandidateTier,
  usedSchoolIds: ReadonlySet<string>,
): RankedOpponent | null {
  const unused = opponents.filter(
    (opponent) => !usedSchoolIds.has(opponent.school.id),
  );
  if (unused.length === 0) return null;

  const preferred = unused.filter((opponent) =>
    tierMatches(tier, opponent.ratio),
  );
  const pool = preferred.length > 0 ? preferred : unused;
  const target = tierTarget(tier);

  return [...pool].sort(
    (left, right) =>
      Math.abs(left.ratio - target) - Math.abs(right.ratio - target) ||
      left.school.id.localeCompare(right.school.id),
  )[0]!;
}

function buildOutgoingCandidates(
  state: PracticePlanningSource,
  recentPracticeMatches: readonly PracticeMatchHistoryEntry[],
): PracticeMatchCandidate[] {
  const homeSchool = state.schools[state.userSchoolId];
  if (!homeSchool) {
    throw new Error("practice planning requires the user school");
  }

  const homeStrength = calculateTournamentSchoolStrength(state, homeSchool);
  const opponents = Object.values(state.schools)
    .filter((school) => school.id !== state.userSchoolId)
    .map((school) => {
      const strength = calculateTournamentSchoolStrength(state, school);
      return {
        school,
        strength,
        ratio: strength / Math.max(1, homeStrength),
      };
    });
  const usedSchoolIds = new Set<string>();
  const tiers: readonly PracticeMatchCandidateTier[] = [
    "same",
    "stronger",
    "challenge",
  ];
  const candidates: PracticeMatchCandidate[] = [];

  for (const tier of tiers) {
    const opponent = selectTierOpponent(opponents, tier, usedSchoolIds);
    if (!opponent) continue;
    usedSchoolIds.add(opponent.school.id);
    const recentMeetingCount = recentPracticeMatches.filter(
      (entry) => entry.opponentSchoolId === opponent.school.id,
    ).length;
    const acceptancePercent = Math.max(
      5,
      Math.min(
        95,
        70 +
          Math.round(
            (homeSchool.reputationPoints - opponent.school.reputationPoints) /
              10,
          ) -
          Math.max(0, opponent.strength - homeStrength) * 2 -
          recentMeetingCount * 15,
      ),
    );

    candidates.push({
      schoolId: opponent.school.id,
      tier,
      acceptancePercent,
      growthRating: practiceRating(opponent.ratio),
      status: "available",
    });
  }

  return candidates;
}

function buildPracticePlanningFromSource(
  state: PracticePlanningSource,
  recentPracticeMatches: readonly PracticeMatchHistoryEntry[],
): PracticePlanningResult {
  return {
    incomingOffer: null,
    outgoingCandidates: buildOutgoingCandidates(state, recentPracticeMatches),
  };
}

export function buildInitialPracticePlanning(
  state: PracticePlanningSource,
): PracticePlanningResult {
  return buildPracticePlanningFromSource(state, []);
}

export function buildPracticePlanning(
  state: GameState,
): PracticePlanningResult {
  return buildPracticePlanningFromSource(
    state,
    state.weeklySchedule.recentPracticeMatches,
  );
}
