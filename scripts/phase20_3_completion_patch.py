from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"expected block not found in {path}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


Path("src/domain/weekly/weeklyScheduleTypes.ts").write_text('''import type {
  TournamentCircuit,
  TournamentLevel,
  TournamentRound,
} from "../tournament/tournamentTypes";
import type { WeeklyPlan } from "../training/resolveWeeklyTraining";
import type { AbilityKey } from "../validation/gameDataSchema";
import type { GameDate, PlayerId, SchoolId } from "../model/identifiers";

export type AutoRestReason = "injury" | "fatigue" | "condition";

export type PracticeMatchCandidateTier = "same" | "stronger" | "challenge";
export type PracticeMatchCandidateStatus =
  "available" | "rejected" | "accepted";

export type PracticeRating = 1 | 2 | 3 | 4 | 5;

export interface PracticeMatchOffer {
  schoolId: SchoolId;
  growthRating: PracticeRating;
  loadRating: PracticeRating;
}

export interface PracticeMatchCandidate {
  schoolId: SchoolId;
  tier: PracticeMatchCandidateTier;
  acceptancePercent: number;
  growthRating: PracticeRating;
  status: PracticeMatchCandidateStatus;
}

export interface PracticeMatchHistoryEntry {
  opponentSchoolId: SchoolId;
  date: GameDate;
}

export interface IncomingPracticeOfferHistoryEntry {
  schoolId: SchoolId;
  surfacedDate: GameDate;
}

export interface WeeklyTrainingGrowthSummary {
  playerId: PlayerId;
  totalAbilityGrowth: number;
  abilityChanges: Partial<Record<AbilityKey, number>>;
}

export interface WeeklyRestRecoverySummary {
  playerId: PlayerId;
  reason: AutoRestReason;
  fatigueBefore: number;
  fatigueAfter: number;
  conditionBefore: number;
  conditionAfter: number;
}

export interface WeeklyReportMatchSummary {
  kind: "practice" | "official";
  opponentDisplayName: string;
  homeSetsWon: number;
  awaySetsWon: number;
  won: boolean;
  circuit: TournamentCircuit | null;
  level: TournamentLevel | null;
  round: TournamentRound | null;
}

export interface WeeklyReport {
  weekStartDate: GameDate;
  weekEndDate: GameDate;
  trainingMenuId: string;
  trainingGrowth: WeeklyTrainingGrowthSummary[];
  restRecoveries: WeeklyRestRecoverySummary[];
  injuredPlayerIds: PlayerId[];
  healedPlayerIds: PlayerId[];
  match: WeeklyReportMatchSummary | null;
  practiceMatchSkippedReason: "insufficient-players" | null;
  cohesionDelta: number;
  reputationDelta: number;
  nextIncomingOfferSchoolId: SchoolId | null;
}

export interface WeeklyScheduleState {
  trainingPlan: WeeklyPlan;
  practiceMatch: {
    incomingOffer: PracticeMatchOffer | null;
    outgoingCandidates: PracticeMatchCandidate[];
    scheduledOpponentId: SchoolId | null;
    scheduledBy: "incoming" | "outgoing" | null;
  };
  incomingPracticeOfferHistory?: IncomingPracticeOfferHistoryEntry[];
  recentPracticeMatches: PracticeMatchHistoryEntry[];
  latestReport: WeeklyReport | null;
}
''', encoding="utf-8")

Path("src/domain/weekly/practiceMatchPlanning.ts").write_text('''import type { GameState } from "../model/GameState";
import type { GameDate, SchoolId } from "../model/identifiers";
import type { School, SchoolReputation } from "../model/School";
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
        entry.surfacedDate === surfacedDate && entry.schoolId === offer.schoolId,
    )
  ) {
    return bounded;
  }
  return [...bounded, { schoolId: offer.schoolId, surfacedDate }].slice(
    -PRACTICE_INCOMING_HISTORY_LIMIT,
  );
}

function rivalryBonus(state: PracticePlanningSource, schoolId: SchoolId): number {
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
  const eligible = candidatePool.length > 0 ? candidatePool : afterMonthlyRepeat;

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
    return leftScore - rightScore || left.school.id.localeCompare(right.school.id);
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
''', encoding="utf-8")

Path("src/domain/weekly/createWeeklySchedule.ts").write_text('''import type { WeeklyPlan } from "../training/resolveWeeklyTraining";
import {
  buildInitialPracticePlanning,
  type PracticePlanningSource,
} from "./practiceMatchPlanning";
import type { WeeklyScheduleState } from "./weeklyScheduleTypes";

type WeeklyScheduleSource = PracticePlanningSource;

export function createDefaultWeeklyPlan(
  state: Pick<WeeklyScheduleSource, "userSchoolId" | "schools">,
): WeeklyPlan {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error("weekly schedule requires the user school");
  }
  if (school.playerIds.length === 0) {
    throw new Error("weekly schedule requires at least one user player");
  }

  return {
    teamTrainingMenuId: "training.spike",
    individualAssignments: school.playerIds.map((playerId) => ({
      playerId,
      instructionId: "instruction.overall",
    })),
  };
}

export function createInitialWeeklySchedule(
  state: WeeklyScheduleSource,
): WeeklyScheduleState {
  const planning = buildInitialPracticePlanning(state);
  const { incomingPracticeOfferHistory, ...practiceMatch } = planning;

  return {
    trainingPlan: createDefaultWeeklyPlan(state),
    practiceMatch: {
      ...practiceMatch,
      scheduledOpponentId: null,
      scheduledBy: null,
    },
    incomingPracticeOfferHistory,
    recentPracticeMatches: [],
    latestReport: null,
  };
}
''', encoding="utf-8")

replace_once(
    "src/domain/calendar/academicYearProgression.ts",
    '''function refreshPracticePlanning(state: GameState): GameState {\n  const planning = buildPracticePlanning(state);\n  return {\n    ...state,\n    weeklySchedule: {\n      ...state.weeklySchedule,\n      practiceMatch: {\n        ...planning,\n        scheduledOpponentId: null,\n        scheduledBy: null,\n      },\n    },\n  };\n}\n''',
    '''function refreshPracticePlanning(state: GameState): GameState {\n  const planning = buildPracticePlanning(state);\n  const { incomingPracticeOfferHistory, ...practiceMatch } = planning;\n  return {\n    ...state,\n    weeklySchedule: {\n      ...state.weeklySchedule,\n      practiceMatch: {\n        ...practiceMatch,\n        scheduledOpponentId: null,\n        scheduledBy: null,\n      },\n      incomingPracticeOfferHistory,\n    },\n  };\n}\n''',
)

replace_once(
    "src/persistence/gameStateCodec.ts",
    '''const practiceIncomingOfferHistoryEntrySchema = z\n  .object({\n    schoolId: z.string().min(1),\n    date: gameDateSchema,\n  })\n  .strict();\n''',
    '''const legacyPracticeIncomingOfferHistoryEntrySchema = z\n  .object({\n    schoolId: z.string().min(1),\n    date: gameDateSchema,\n  })\n  .strict();\n\nconst incomingPracticeOfferHistoryEntrySchema = z\n  .object({\n    schoolId: z.string().min(1),\n    surfacedDate: gameDateSchema,\n  })\n  .strict();\n''',
)

replace_once(
    "src/persistence/gameStateCodec.ts",
    '''const weeklyScheduleSchema = z\n  .object({\n    trainingPlan: weeklyPlanSchema,\n    practiceMatch: z\n      .object({\n        incomingOffer: practiceMatchOfferSchema.nullable(),\n        outgoingCandidates: z.array(practiceMatchCandidateSchema).max(3),\n        scheduledOpponentId: z.string().min(1).nullable(),\n        scheduledBy: z.enum(["incoming", "outgoing"]).nullable(),\n        incomingOfferHistory: z\n          .array(practiceIncomingOfferHistoryEntrySchema)\n          .max(24)\n          .default([]),\n      })\n      .strict(),\n    recentPracticeMatches: z.array(practiceMatchHistoryEntrySchema).max(12),\n    latestReport: weeklyReportSchema.nullable(),\n  })\n  .strict();\n''',
    '''const weeklyScheduleSchema = z\n  .object({\n    trainingPlan: weeklyPlanSchema,\n    practiceMatch: z\n      .object({\n        incomingOffer: practiceMatchOfferSchema.nullable(),\n        outgoingCandidates: z.array(practiceMatchCandidateSchema).max(3),\n        scheduledOpponentId: z.string().min(1).nullable(),\n        scheduledBy: z.enum(["incoming", "outgoing"]).nullable(),\n        incomingOfferHistory: z\n          .array(legacyPracticeIncomingOfferHistoryEntrySchema)\n          .max(24)\n          .optional(),\n      })\n      .strict(),\n    incomingPracticeOfferHistory: z\n      .array(incomingPracticeOfferHistoryEntrySchema)\n      .max(32)\n      .optional(),\n    recentPracticeMatches: z.array(practiceMatchHistoryEntrySchema).max(12),\n    latestReport: weeklyReportSchema.nullable(),\n  })\n  .strict()\n  .transform((state) => {\n    const legacyHistory = state.practiceMatch.incomingOfferHistory ?? [];\n    const incomingPracticeOfferHistory =\n      state.incomingPracticeOfferHistory ??\n      legacyHistory.map((entry) => ({\n        schoolId: entry.schoolId,\n        surfacedDate: entry.date,\n      }));\n    const { incomingOfferHistory: _legacyHistory, ...practiceMatch } =\n      state.practiceMatch;\n    return {\n      ...state,\n      practiceMatch,\n      incomingPracticeOfferHistory,\n    };\n  });\n''',
)

frequency = Path("tests/unit/domain/weekly/phase20PracticeOfferFrequency.test.ts")
text = frequency.read_text(encoding="utf-8")
text = text.replace("  date: GameDate;", "  surfacedDate: GameDate;")
text = text.replace(
    '''    weeklySchedule: {\n      ...state.weeklySchedule,\n      practiceMatch: {\n        ...state.weeklySchedule.practiceMatch,\n        incomingOfferHistory: entries.map((entry) => ({ ...entry })),\n      },\n    },''',
    '''    weeklySchedule: {\n      ...state.weeklySchedule,\n      incomingPracticeOfferHistory: entries.map((entry) => ({ ...entry })),\n    },''',
)
text = text.replace(" date: \"2026-04-03\"", " surfacedDate: \"2026-04-03\"")
text = text.replace(" date: \"2026-04-10\"", " surfacedDate: \"2026-04-10\"")
text = text.replace(" date: \"2026-04-02\"", " surfacedDate: \"2026-04-02\"")
text = text.replace(" date: \"2026-01-08\"", " surfacedDate: \"2026-01-08\"")
text = text.replace(" date: \"2026-02-05\"", " surfacedDate: \"2026-02-05\"")
text = text.replace(" date: \"2026-02-19\"", " surfacedDate: \"2026-02-19\"")
text = text.replace(" date: \"2026-03-05\"", " surfacedDate: \"2026-03-05\"")
text = text.replace(" date: \"2026-04-17\"", " surfacedDate: \"2026-04-17\"")
frequency.write_text(text, encoding="utf-8")

history_codec = Path("tests/unit/persistence/phase20PracticeOfferHistoryCodec.test.ts")
text = history_codec.read_text(encoding="utf-8")
text = text.replace("      date: `2025-", "      surfacedDate: `2025-")
text = text.replace(
    '''    const legacyPracticeMatch = state.weeklySchedule\n      .practiceMatch as typeof state.weeklySchedule.practiceMatch & {\n      incomingOfferHistory?: unknown;\n    };\n    delete legacyPracticeMatch.incomingOfferHistory;''',
    '''    delete state.weeklySchedule.incomingPracticeOfferHistory;''',
)
text = text.replace(
    '''expect(decoded.weeklySchedule.practiceMatch.incomingOfferHistory).toEqual(\n      [],\n    );''',
    '''expect(decoded.weeklySchedule.incomingPracticeOfferHistory).toEqual([]);''',
)
text = text.replace(
    "state.weeklySchedule.practiceMatch.incomingOfferHistory = [",
    "state.weeklySchedule.incomingPracticeOfferHistory = [",
)
text = text.replace("{ schoolId: opponents[0]!, date: \"2026-04-03\" as GameDate }", "{ schoolId: opponents[0]!, surfacedDate: \"2026-04-03\" as GameDate }")
text = text.replace("{ schoolId: opponents[1]!, date: \"2026-04-17\" as GameDate }", "{ schoolId: opponents[1]!, surfacedDate: \"2026-04-17\" as GameDate }")
text = text.replace(
    '''expect(decoded.weeklySchedule.practiceMatch.incomingOfferHistory).toEqual(\n      state.weeklySchedule.practiceMatch.incomingOfferHistory,\n    );''',
    '''expect(decoded.weeklySchedule.incomingPracticeOfferHistory).toEqual(\n      state.weeklySchedule.incomingPracticeOfferHistory,\n    );''',
)
text = text.replace(
    "state.weeklySchedule.practiceMatch.incomingOfferHistory =\n      previousOfferHistory(opponent);",
    "state.weeklySchedule.incomingPracticeOfferHistory =\n      previousOfferHistory(opponent);",
)
text = text.replace("planning.incomingOfferHistory", "planning.incomingPracticeOfferHistory")
text = text.replace("date: state.date", "surfacedDate: state.date")
text = text.replace(
    "state.weeklySchedule.practiceMatch.incomingOfferHistory = [",
    "state.weeklySchedule.incomingPracticeOfferHistory = [",
)
text = text.replace("{ schoolId: opponent, date: \"2025-12-31\" as GameDate }", "{ schoolId: opponent, surfacedDate: \"2025-12-31\" as GameDate }")
history_codec.write_text(text, encoding="utf-8")

# Ensure the already-shipped nested shape remains covered by the canonical codec test,
# while all runtime tests use the new canonical top-level ledger.
print("Phase20-3 completion patch applied")
