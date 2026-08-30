import type { GameState } from "../model/GameState";
import type { School, SchoolReputation } from "../model/School";
import { SeededRandom } from "../random/SeededRandom";
import { calculateTournamentSchoolStrength } from "../tournament/createOfficialSeason";
import type {
  PracticeMatchCandidate,
  PracticeMatchCandidateTier,
  PracticeMatchHistoryEntry,
  PracticeMatchOffer,
  PracticeRating,
} from "./weeklyScheduleTypes";

export const PRACTICE_INCOMING_CHANCE: Record<SchoolReputation, number> = {
  unknown: 20,
  "district-contender": 30,
  "prefectural-power": 45,
  "national-qualifier": 52,
  "national-regular": 58,
  elite: 65,
};

export const PRACTICE_INCOMING_TARGET_RATIO: Record<
  SchoolReputation,
  number
> = {
  unknown: 0.9,
  "district-contender": 0.95,
  "prefectural-power": 1,
  "national-qualifier": 1.05,
  "national-regular": 1.1,
  elite: 1.15,
};

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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function practiceRating(ratio: number): PracticeRating {
  if (ratio <= 0.85) return 1;
  if (ratio <= 0.95) return 2;
  if (ratio <= 1.05) return 3;
  if (ratio <= 1.15) return 4;
  return 5;
}

export function practiceAcceptancePercent(
  homeReputationPoints: number,
  opponentReputationPoints: number,
  homeStrength: number,
  opponentStrength: number,
  recentMeetingCount: number,
): number {
  return clamp(
    70 +
      Math.round((homeReputationPoints - opponentReputationPoints) / 10) -
      Math.max(0, opponentStrength - homeStrength) * 2 -
      recentMeetingCount * 15,
    5,
    95,
  );
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

function rankedOpponents(state: PracticePlanningSource): {
  homeSchool: School;
  homeStrength: number;
  opponents: RankedOpponent[];
} {
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

  return { homeSchool, homeStrength, opponents };
}

function buildOutgoingCandidates(
  state: PracticePlanningSource,
  recentPracticeMatches: readonly PracticeMatchHistoryEntry[],
  excludedSchoolIds: ReadonlySet<string> = new Set(),
): PracticeMatchCandidate[] {
  const { homeSchool, homeStrength, opponents } = rankedOpponents(state);
  const usedSchoolIds = new Set<string>(excludedSchoolIds);
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

    candidates.push({
      schoolId: opponent.school.id,
      tier,
      acceptancePercent: practiceAcceptancePercent(
        homeSchool.reputationPoints,
        opponent.school.reputationPoints,
        homeStrength,
        opponent.strength,
        recentMeetingCount,
      ),
      growthRating: practiceRating(opponent.ratio),
      status: "available",
    });
  }

  return candidates;
}

function hasDueOfficialMatch(state: PracticePlanningSource): boolean {
  const stages = [
    state.officialSeason.interhigh.prefectural,
    state.officialSeason.interhigh.national,
    state.officialSeason.springHigh.prefectural,
    state.officialSeason.springHigh.national,
  ];

  for (const stage of stages) {
    if (!stage || stage.userEliminated) continue;
    const userEntrant = stage.entrants.find(
      (entrant) =>
        entrant.source === "world-school" &&
        entrant.schoolId === state.userSchoolId,
    );
    if (!userEntrant) continue;
    if (
      stage.matches.some(
        (match) =>
          match.status === "user-required" &&
          (match.homeEntrantId === userEntrant.entrantId ||
            match.awayEntrantId === userEntrant.entrantId),
      )
    ) {
      return true;
    }
  }

  return false;
}

function buildIncomingOffer(
  state: PracticePlanningSource,
): PracticeMatchOffer | null {
  const { homeSchool, opponents } = rankedOpponents(state);
  if (opponents.length === 0) return null;

  const random = new SeededRandom(state.seed).fork(
    `practice-incoming:${state.date}:${state.userSchoolId}`,
  );
  if (random.int(1, 100) > PRACTICE_INCOMING_CHANCE[homeSchool.reputation]) {
    return null;
  }

  const targetRatio = PRACTICE_INCOMING_TARGET_RATIO[homeSchool.reputation];
  const opponent = [...opponents].sort(
    (left, right) =>
      Math.abs(left.ratio - targetRatio) -
        Math.abs(right.ratio - targetRatio) ||
      left.school.id.localeCompare(right.school.id),
  )[0]!;
  const rating = practiceRating(opponent.ratio);

  return {
    schoolId: opponent.school.id,
    growthRating: rating,
    loadRating: rating,
  };
}

function buildPracticePlanningFromSource(
  state: PracticePlanningSource,
  recentPracticeMatches: readonly PracticeMatchHistoryEntry[],
): PracticePlanningResult {
  if (hasDueOfficialMatch(state)) {
    return {
      incomingOffer: null,
      outgoingCandidates: [],
    };
  }

  const incomingOffer = buildIncomingOffer(state);
  return {
    incomingOffer,
    outgoingCandidates: buildOutgoingCandidates(
      state,
      recentPracticeMatches,
      incomingOffer ? new Set([incomingOffer.schoolId]) : undefined,
    ),
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
