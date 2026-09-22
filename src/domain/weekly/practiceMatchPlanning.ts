import { isWeeklyActionCompleted } from "../calendar/weekProgression";
import type { GameState } from "../model/GameState";
import type { GameDate, SchoolId } from "../model/identifiers";
import type { School, SchoolReputation } from "../model/School";
import type { SeasonAmbition } from "../season/seasonGoalTypes";
import { SeededRandom } from "../random/SeededRandom";
import { calculateTournamentSchoolStrength } from "../tournament/createOfficialSeason";
import { rivalryKey } from "../world/rivalWorldProgression";
import type {
  IncomingPracticeOfferHistoryEntry,
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

export const PRACTICE_INCOMING_TARGET_RATIO: Record<SchoolReputation, number> =
  {
    unknown: 0.9,
    "district-contender": 0.95,
    "prefectural-power": 1,
    "national-qualifier": 1.05,
    "national-regular": 1.1,
    elite: 1.15,
  };

export const PRACTICE_INCOMING_MONTHLY_LIMIT = 2;
export const PRACTICE_INCOMING_HISTORY_LIMIT = 32;
export const PRACTICE_INCOMING_REPEAT_COOLDOWN_DAYS = 56;

const PRACTICE_MEETING_REPEAT_PENALTY = 0.12;
const PRACTICE_OFFER_REPEAT_PENALTY = 0.04;
const PRACTICE_RIVALRY_SCORE_BONUS = 0.12;
const PRACTICE_DESTINY_RIVAL_BONUS = 0.08;

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
  | "world"
>;

export interface PracticePlanningResult {
  incomingOffer: PracticeMatchOffer | null;
  outgoingCandidates: PracticeMatchCandidate[];
  incomingPracticeOfferHistory: IncomingPracticeOfferHistoryEntry[];
}

export type PracticeRecommendationSource =
  | "season-ambition"
  | "last-practice-result";

export interface PracticeRecommendation {
  ambition: SeasonAmbition;
  tier: PracticeMatchCandidateTier;
  candidate: PracticeMatchCandidate;
  source: PracticeRecommendationSource;
  previousResult?: {
    won: boolean;
    tier: PracticeMatchCandidateTier;
  };
}

const ambitionTierPriority: Record<
  SeasonAmbition,
  readonly PracticeMatchCandidateTier[]
> = {
  steady: ["same", "stronger", "challenge"],
  challenge: ["stronger", "same", "challenge"],
  bold: ["challenge", "stronger", "same"],
};

export function classifyPracticeOpponentTier(
  userStrength: number,
  opponentStrength: number,
): PracticeMatchCandidateTier {
  const ratio = opponentStrength / Math.max(1, userStrength);
  if (ratio <= 1) return "same";
  if (ratio <= 1.15) return "stronger";
  return "challenge";
}

export function nextPracticeTierFromResult(
  tier: PracticeMatchCandidateTier,
  won: boolean,
): PracticeMatchCandidateTier {
  if (won) {
    if (tier === "same") return "stronger";
    if (tier === "stronger") return "challenge";
    return "challenge";
  }
  if (tier === "challenge") return "stronger";
  return tier;
}

function resultAwareTierPriority(
  target: PracticeMatchCandidateTier,
): readonly PracticeMatchCandidateTier[] {
  if (target === "same") return ["same", "stronger", "challenge"];
  if (target === "stronger") return ["stronger", "same", "challenge"];
  return ["challenge", "stronger", "same"];
}

function latestPracticeResult(
  state: GameState,
): { won: boolean; tier: PracticeMatchCandidateTier } | null {
  const latest = state.weeklySchedule.recentPracticeMatches.at(-1);
  if (!latest) return null;

  const historicalMatch = [...state.history.matches]
    .reverse()
    .find((match) => {
      if (match.tournamentId !== null || match.date !== latest.date) return false;
      const opponentId =
        match.homeSchoolId === state.userSchoolId
          ? match.awaySchoolId
          : match.awaySchoolId === state.userSchoolId
            ? match.homeSchoolId
            : null;
      return opponentId === latest.opponentSchoolId;
    });
  if (!historicalMatch) return null;

  const home = state.schools[state.userSchoolId];
  const opponent = state.schools[latest.opponentSchoolId];
  if (!home || !opponent) return null;

  return {
    won: historicalMatch.winnerSchoolId === state.userSchoolId,
    tier: classifyPracticeOpponentTier(
      calculateTournamentSchoolStrength(state, home),
      calculateTournamentSchoolStrength(state, opponent),
    ),
  };
}

export function selectPracticeRecommendation(
  state: GameState,
): PracticeRecommendation | null {
  const practice = state.weeklySchedule.practiceMatch;
  if (
    isWeeklyActionCompleted(state, "practice-match") ||
    practice.scheduledOpponentId ||
    practice.incomingOffer ||
    practice.outgoingCandidates.length === 0
  ) {
    return null;
  }

  const ambition = state.seasonGoals?.ambition ?? "challenge";
  const available = practice.outgoingCandidates.filter(
    (candidate) => candidate.status === "available",
  );
  if (available.length === 0) return null;

  const previousResult = latestPracticeResult(state);
  if (previousResult) {
    const target = nextPracticeTierFromResult(
      previousResult.tier,
      previousResult.won,
    );
    for (const tier of resultAwareTierPriority(target)) {
      const candidate = available.find((item) => item.tier === tier);
      if (candidate) {
        return {
          ambition,
          tier,
          candidate,
          source: "last-practice-result",
          previousResult,
        };
      }
    }
  }

  for (const tier of ambitionTierPriority[ambition]) {
    const candidate = available.find((item) => item.tier === tier);
    if (candidate) {
      return {
        ambition,
        tier,
        candidate,
        source: "season-ambition",
      };
    }
  }

  return null;
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

function meetingCount(
  recentPracticeMatches: readonly PracticeMatchHistoryEntry[],
  schoolId: string,
): number {
  return recentPracticeMatches.filter(
    (entry) => entry.opponentSchoolId === schoolId,
  ).length;
}

export function practiceOfferMonthKey(date: GameDate): string {
  return date.slice(0, 7);
}

export function countIncomingOffersForMonth(
  history: readonly IncomingPracticeOfferHistoryEntry[],
  date: GameDate,
): number {
  const month = practiceOfferMonthKey(date);
  return history.filter(
    (entry) => practiceOfferMonthKey(entry.surfacedDate) === month,
  ).length;
}

function parseGameDateUtc(date: GameDate): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!);
}

export function wasIncomingOfferRecentlySurfaced(
  history: readonly IncomingPracticeOfferHistoryEntry[],
  schoolId: SchoolId,
  currentDate: GameDate,
  cooldownDays = PRACTICE_INCOMING_REPEAT_COOLDOWN_DAYS,
): boolean {
  const currentTime = parseGameDateUtc(currentDate);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return history.some((entry) => {
    if (entry.schoolId !== schoolId) return false;
    const differenceDays =
      (currentTime - parseGameDateUtc(entry.surfacedDate)) / millisecondsPerDay;
    return differenceDays >= 0 && differenceDays <= cooldownDays;
  });
}

function incomingOfferCount(
  history: readonly IncomingPracticeOfferHistoryEntry[],
  schoolId: SchoolId,
): number {
  return history.filter((entry) => entry.schoolId === schoolId).length;
}

export function appendIncomingPracticeOfferHistory(
  history: readonly IncomingPracticeOfferHistoryEntry[],
  offer: PracticeMatchOffer | null,
  surfacedDate: GameDate,
): IncomingPracticeOfferHistoryEntry[] {
  const bounded = [...history].slice(-PRACTICE_INCOMING_HISTORY_LIMIT);
  if (!offer) return bounded;
  if (
    bounded.some(
      (entry) =>
        entry.surfacedDate === surfacedDate &&
        entry.schoolId === offer.schoolId,
    )
  ) {
    return bounded;
  }
  return [...bounded, { schoolId: offer.schoolId, surfacedDate }].slice(
    -PRACTICE_INCOMING_HISTORY_LIMIT,
  );
}

function rivalryBonus(
  state: PracticePlanningSource,
  schoolId: SchoolId,
): number {
  const score =
    state.world.rivalryScores[rivalryKey(state.userSchoolId, schoolId)] ?? 0;
  return (
    (Math.max(0, Math.min(100, score)) / 100) * PRACTICE_RIVALRY_SCORE_BONUS +
    (state.world.destinyRivalSchoolId === schoolId
      ? PRACTICE_DESTINY_RIVAL_BONUS
      : 0)
  );
}

function buildIncomingOffer(
  state: PracticePlanningSource,
  recentPracticeMatches: readonly PracticeMatchHistoryEntry[],
  incomingOfferHistory: readonly IncomingPracticeOfferHistoryEntry[],
): PracticeMatchOffer | null {
  const { homeSchool, opponents } = rankedOpponents(state);
  if (opponents.length === 0) return null;

  if (
    countIncomingOffersForMonth(incomingOfferHistory, state.date) >=
    PRACTICE_INCOMING_MONTHLY_LIMIT
  ) {
    return null;
  }

  const random = new SeededRandom(state.seed).fork(
    `practice-incoming:${state.date}:${state.userSchoolId}`,
  );
  if (random.int(1, 100) > PRACTICE_INCOMING_CHANCE[homeSchool.reputation]) {
    return null;
  }

  const cooldownEligible = opponents.filter(
    (opponent) =>
      !wasIncomingOfferRecentlySurfaced(
        incomingOfferHistory,
        opponent.school.id,
        state.date,
      ),
  );
  const afterCooldown =
    cooldownEligible.length > 0 ? cooldownEligible : opponents;

  const offersThisMonth = incomingOfferHistory.filter(
    (entry) =>
      practiceOfferMonthKey(entry.surfacedDate) ===
      practiceOfferMonthKey(state.date),
  );
  const offeredThisMonthSchoolIds = new Set(
    offersThisMonth.map((entry) => entry.schoolId),
  );
  const afterMonthlyRepeat = afterCooldown.some(
    (opponent) => !offeredThisMonthSchoolIds.has(opponent.school.id),
  )
    ? afterCooldown.filter(
        (opponent) => !offeredThisMonthSchoolIds.has(opponent.school.id),
      )
    : afterCooldown;

  const lastOpponentId = recentPracticeMatches.at(-1)?.opponentSchoolId ?? null;
  const candidatePool =
    lastOpponentId && afterMonthlyRepeat.length > 1
      ? afterMonthlyRepeat.filter(
          (opponent) => opponent.school.id !== lastOpponentId,
        )
      : afterMonthlyRepeat;
  const eligible =
    candidatePool.length > 0 ? candidatePool : afterMonthlyRepeat;

  const targetRatio = PRACTICE_INCOMING_TARGET_RATIO[homeSchool.reputation];
  const ranked = [...eligible].sort((left, right) => {
    const leftScore =
      Math.abs(left.ratio - targetRatio) +
      meetingCount(recentPracticeMatches, left.school.id) *
        PRACTICE_MEETING_REPEAT_PENALTY +
      incomingOfferCount(incomingOfferHistory, left.school.id) *
        PRACTICE_OFFER_REPEAT_PENALTY -
      rivalryBonus(state, left.school.id);
    const rightScore =
      Math.abs(right.ratio - targetRatio) +
      meetingCount(recentPracticeMatches, right.school.id) *
        PRACTICE_MEETING_REPEAT_PENALTY +
      incomingOfferCount(incomingOfferHistory, right.school.id) *
        PRACTICE_OFFER_REPEAT_PENALTY -
      rivalryBonus(state, right.school.id);
    return (
      leftScore - rightScore || left.school.id.localeCompare(right.school.id)
    );
  });

  const pool = ranked.slice(0, Math.min(4, ranked.length));
  const opponent = random.pick(pool);
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
  incomingOfferHistory: readonly IncomingPracticeOfferHistoryEntry[],
): PracticePlanningResult {
  if (hasDueOfficialMatch(state)) {
    return {
      incomingOffer: null,
      outgoingCandidates: [],
      incomingPracticeOfferHistory: appendIncomingPracticeOfferHistory(
        incomingOfferHistory,
        null,
        state.date,
      ),
    };
  }

  const incomingOffer = buildIncomingOffer(
    state,
    recentPracticeMatches,
    incomingOfferHistory,
  );
  return {
    incomingOffer,
    outgoingCandidates: buildOutgoingCandidates(
      state,
      recentPracticeMatches,
      incomingOffer ? new Set([incomingOffer.schoolId]) : undefined,
    ),
    incomingPracticeOfferHistory: appendIncomingPracticeOfferHistory(
      incomingOfferHistory,
      incomingOffer,
      state.date,
    ),
  };
}

export function buildInitialPracticePlanning(
  state: PracticePlanningSource,
): PracticePlanningResult {
  return buildPracticePlanningFromSource(state, [], []);
}

export function buildPracticePlanning(
  state: GameState,
): PracticePlanningResult {
  return buildPracticePlanningFromSource(
    state,
    state.weeklySchedule.recentPracticeMatches,
    state.weeklySchedule.incomingPracticeOfferHistory ?? [],
  );
}
