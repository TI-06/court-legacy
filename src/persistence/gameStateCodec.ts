import { z } from "zod";
import { createInitialTeamDynamics } from "../domain/dynamics/createInitialTeamDynamics";
import {
  CURRENT_GAME_SCHEMA_VERSION,
  createDefaultGameSettings,
  type GameState,
} from "../domain/model/GameState";
import { createOfficialSeason } from "../domain/tournament/createOfficialSeason";
import { abilityKeySchema } from "../domain/validation/gameDataSchema";
import { createInitialWeeklySchedule } from "../domain/weekly/createWeeklySchedule";

const gameDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const objectSchema = z.object({}).passthrough();

const gameSettingsSchema = z.object({
  matchDisplayMode: z.enum(["normal", "fast", "text", "instant"]),
  matchPlaybackSpeed: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  reducedMotion: z.boolean(),
  confirmBeforeOfficialMatch: z.boolean(),
  autosaveEnabled: z.boolean(),
});

const recruitingStateSchema = z.object({
  cycleKey: z.string().min(1),
  committedCandidateIds: z.array(z.string().min(1)),
});

const shopGameEffectsSchema = z
  .object({
    nextTrainingGrowthBoost: z
      .object({
        percent: z.literal(20),
        remainingUses: z.literal(1),
        sourceItemId: z.literal("training-efficiency-boost"),
      })
      .strict()
      .optional(),
  })
  .strict();

const assistantCoachContractSchema = z
  .object({
    rank: z.enum(["beginner", "intermediate", "advanced", "master"]),
    specialty: z.enum(["attack", "defense", "physical"]).nullable(),
    contractYearIndex: z.number().int().positive(),
  })
  .strict();

const fundsLedgerKindSchema = z.enum([
  "initial-funds",
  "annual-budget",
  "tournament-reward",
  "event",
  "shop-grant",
  "facility-upgrade",
  "assistant-coach",
  "scouting-research",
  "camp",
  "travel",
]);

const fundsLedgerEntrySchema = z
  .object({
    id: z.string().min(1),
    gameDate: gameDateSchema,
    academicYearIndex: z.number().int().positive(),
    kind: fundsLedgerKindSchema,
    amount: z.number().int(),
    balanceAfter: z.number().int().nonnegative(),
    label: z.string().min(1),
    relatedId: z.string().min(1).optional(),
  })
  .strict();

const schoolManagementSchema = z
  .object({
    assistantCoach: assistantCoachContractSchema.nullable(),
    fundsHistory: z.array(fundsLedgerEntrySchema).max(50),
    lastAnnualBudgetYearIndex: z.number().int().positive(),
  })
  .strict();

const notificationPlayerSchema = z
  .object({
    playerId: z.string().min(1),
    displayName: z.string().min(1),
    grade: z.number().int().min(1).max(3),
    preferredPosition: z.enum(["OH", "MB", "OP", "S", "L"]),
    totalAbilityGrowth: z.number().int().nonnegative(),
    fatigueChange: z.number().int(),
    conditionChange: z.number().int(),
    trustChange: z.number().int(),
    injured: z.boolean(),
    abilityChanges: z.partialRecord(abilityKeySchema, z.number().int()),
  })
  .strict();

const trainingResultNotificationSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("training-result"),
    createdGameDate: gameDateSchema,
    academicYearIndex: z.number().int().positive(),
    weekOfYear: z.number().int().positive(),
    readAtGameDate: gameDateSchema.nullable(),
    payload: z
      .object({
        teamTrainingMenuName: z.string().min(1),
        totalAbilityGrowth: z.number().int().nonnegative(),
        totalFatigueChange: z.number().int(),
        injuredCount: z.number().int().nonnegative(),
        players: z.array(notificationPlayerSchema),
      })
      .strict(),
  })
  .strict();

const notificationStateSchema = z
  .object({
    items: z.array(trainingResultNotificationSchema).max(20),
  })
  .strict();

const playerRoleSchema = z.enum([
  "ace",
  "starter",
  "rotation",
  "development",
  "reserve",
]);
const playerConcernCodeSchema = z.enum([
  "playing-time",
  "role-mismatch",
  "injury-overuse",
  "team-slump",
]);
const playerConcernSchema = z.object({
  code: playerConcernCodeSchema,
  severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

const teamDynamicsSchema = z.object({
  captainPlayerId: z.string().min(1).nullable(),
  viceCaptainPlayerId: z.string().min(1).nullable(),
  cohesion: z.number().int().min(0).max(100),
  previousCohesion: z.number().int().min(0).max(100),
  cohesionTrend: z.enum(["rising", "stable", "falling"]),
  playerRoles: z.record(z.string(), playerRoleSchema),
  playerConcerns: z.record(z.string(), z.array(playerConcernSchema)),
  lineupContinuity: z.number().int().min(0).max(100),
  recentOfficialStarterCounts: z.record(
    z.string(),
    z.number().int().nonnegative(),
  ),
  recentOfficialMatchesTracked: z.number().int().min(0).max(8),
});

const weeklyPlanSchema = z
  .object({
    teamTrainingMenuId: z.string().min(1),
    individualAssignments: z
      .array(
        z
          .object({
            playerId: z.string().min(1),
            instructionId: z.string().min(1),
          })
          .strict(),
      )
      .max(64),
  })
  .strict();

const practiceRatingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const practiceMatchOfferSchema = z
  .object({
    schoolId: z.string().min(1),
    growthRating: practiceRatingSchema,
    loadRating: practiceRatingSchema,
  })
  .strict();

const practiceMatchCandidateSchema = z
  .object({
    schoolId: z.string().min(1),
    tier: z.enum(["same", "stronger", "challenge"]),
    acceptancePercent: z.number().int().min(5).max(95),
    growthRating: practiceRatingSchema,
    status: z.enum(["available", "rejected", "accepted"]),
  })
  .strict();

const practiceMatchHistoryEntrySchema = z
  .object({
    opponentSchoolId: z.string().min(1),
    date: gameDateSchema,
  })
  .strict();

const weeklyTrainingGrowthSummarySchema = z
  .object({
    playerId: z.string().min(1),
    totalAbilityGrowth: z.number().int().nonnegative(),
    abilityChanges: z.partialRecord(abilityKeySchema, z.number().int()),
  })
  .strict();

const autoRestReasonSchema = z.enum(["injury", "fatigue", "condition"]);

const weeklyRestRecoverySummarySchema = z
  .object({
    playerId: z.string().min(1),
    reason: autoRestReasonSchema,
    fatigueBefore: z.number().int().min(0).max(100),
    fatigueAfter: z.number().int().min(0).max(100),
    conditionBefore: z.number().int().min(0).max(100),
    conditionAfter: z.number().int().min(0).max(100),
  })
  .strict();

const weeklyReportMatchSummarySchema = z
  .object({
    kind: z.enum(["practice", "official"]),
    opponentDisplayName: z.string().min(1),
    homeSetsWon: z.number().int().nonnegative(),
    awaySetsWon: z.number().int().nonnegative(),
    won: z.boolean(),
    circuit: z.enum(["interhigh", "spring-high"]).nullable(),
    level: z.enum(["prefectural", "national"]).nullable(),
    round: z
      .enum(["round-of-16", "quarterfinal", "semifinal", "final"])
      .nullable(),
  })
  .strict();

const weeklyReportSchema = z
  .object({
    weekStartDate: gameDateSchema,
    weekEndDate: gameDateSchema,
    trainingMenuId: z.string().min(1),
    trainingGrowth: z.array(weeklyTrainingGrowthSummarySchema),
    restRecoveries: z.array(weeklyRestRecoverySummarySchema),
    injuredPlayerIds: z.array(z.string().min(1)),
    healedPlayerIds: z.array(z.string().min(1)),
    match: weeklyReportMatchSummarySchema.nullable(),
    practiceMatchSkippedReason: z.literal("insufficient-players").nullable(),
    cohesionDelta: z.number().int(),
    reputationDelta: z.number().int(),
    nextIncomingOfferSchoolId: z.string().min(1).nullable(),
  })
  .strict();

const weeklyScheduleSchema = z
  .object({
    trainingPlan: weeklyPlanSchema,
    practiceMatch: z
      .object({
        incomingOffer: practiceMatchOfferSchema.nullable(),
        outgoingCandidates: z.array(practiceMatchCandidateSchema).max(3),
        scheduledOpponentId: z.string().min(1).nullable(),
        scheduledBy: z.enum(["incoming", "outgoing"]).nullable(),
      })
      .strict(),
    recentPracticeMatches: z.array(practiceMatchHistoryEntrySchema).max(12),
    latestReport: weeklyReportSchema.nullable(),
  })
  .strict();

const gameStateSchema = z
  .object({
    schemaVersion: z.number().int().nonnegative(),
    seed: z.string().min(1),
    randomCursor: z.number().int().nonnegative(),
    date: gameDateSchema,
    yearIndex: z.number().int().positive(),
    userSchoolId: z.string().min(1),
    schools: z.record(z.string(), objectSchema),
    players: z.record(z.string(), objectSchema),
    playerRelationships: z.record(z.string(), z.number().min(0).max(100)),
    calendar: objectSchema,
    activeMatch: z.unknown().nullable(),
    pendingEvent: z.unknown().nullable(),
    history: objectSchema,
    eventMemory: objectSchema,
    settings: gameSettingsSchema,
    world: objectSchema,
    officialSeason: objectSchema,
    teamDynamics: teamDynamicsSchema,
    weeklySchedule: weeklyScheduleSchema,
    notifications: notificationStateSchema,
    schoolManagement: schoolManagementSchema,
    recruiting: recruitingStateSchema.optional(),
    shopEffects: shopGameEffectsSchema.optional(),
  })
  .passthrough();

const versionProbeSchema = z
  .object({
    schemaVersion: z.number().int().nonnegative(),
  })
  .passthrough();

type OfficialSeasonSource = Parameters<typeof createOfficialSeason>[0]["state"];
type InitialDynamicsSource = Parameters<typeof createInitialTeamDynamics>[0];
type InitialWeeklyScheduleSource = Parameters<
  typeof createInitialWeeklySchedule
>[0];

function historyWithOfficialTournaments(
  history: unknown,
): Record<string, unknown> {
  const legacyHistory =
    history && typeof history === "object" && !Array.isArray(history)
      ? (history as Record<string, unknown>)
      : {};

  return {
    ...legacyHistory,
    officialTournaments: [],
  };
}

function migrateVersionSix(legacy: Record<string, unknown>): unknown {
  const yearIndex =
    typeof legacy.yearIndex === "number" && Number.isInteger(legacy.yearIndex)
      ? legacy.yearIndex
      : 1;
  return {
    ...legacy,
    schemaVersion: CURRENT_GAME_SCHEMA_VERSION,
    schoolManagement: {
      assistantCoach: null,
      fundsHistory: [],
      lastAnnualBudgetYearIndex: yearIndex,
    },
  };
}

function migrateVersionFive(legacy: Record<string, unknown>): unknown {
  return migrateVersionSix({
    ...legacy,
    schemaVersion: 6,
    notifications: { items: [] },
  });
}

function migrateVersionFour(legacy: Record<string, unknown>): unknown {
  const migratedVersionFive = {
    ...legacy,
    schemaVersion: 5,
  };

  return migrateVersionFive({
    ...migratedVersionFive,
    weeklySchedule: createInitialWeeklySchedule(
      migratedVersionFive as unknown as InitialWeeklyScheduleSource,
    ),
  });
}

function migrateVersionThree(legacy: Record<string, unknown>): unknown {
  const migratedVersionFour = {
    ...legacy,
    schemaVersion: 4,
  };

  return migrateVersionFour({
    ...migratedVersionFour,
    teamDynamics: createInitialTeamDynamics(
      migratedVersionFour as unknown as InitialDynamicsSource,
    ),
  });
}

function migrateVersionTwo(legacy: Record<string, unknown>): unknown {
  const migratedVersionThree = {
    ...legacy,
    schemaVersion: 3,
    history: historyWithOfficialTournaments(legacy.history),
  };

  return migrateVersionThree({
    ...migratedVersionThree,
    officialSeason: createOfficialSeason({
      state: migratedVersionThree as unknown as OfficialSeasonSource,
    }),
  });
}

function migrateVersionZero(legacy: Record<string, unknown>): unknown {
  const legacySettings =
    legacy.settings && typeof legacy.settings === "object"
      ? (legacy.settings as Record<string, unknown>)
      : {};

  return migrateVersionTwo({
    ...legacy,
    schemaVersion: 2,
    playerRelationships: {},
    settings: {
      ...createDefaultGameSettings(),
      ...legacySettings,
    },
  });
}

function migrateVersionOne(legacy: Record<string, unknown>): unknown {
  return migrateVersionTwo({
    ...legacy,
    schemaVersion: 2,
    playerRelationships: {},
  });
}

function migrateLegacyState(value: unknown): unknown {
  const probe = versionProbeSchema.safeParse(value);
  if (!probe.success) {
    throw new Error("セーブデータの形式が正しくありません");
  }

  const version = probe.data.schemaVersion;
  if (version > CURRENT_GAME_SCHEMA_VERSION) {
    throw new Error("新しいバージョンのセーブデータです");
  }

  if (version === CURRENT_GAME_SCHEMA_VERSION) {
    return value;
  }

  const legacy = value as Record<string, unknown>;
  if (version === 0) {
    return migrateVersionZero(legacy);
  }
  if (version === 1) {
    return migrateVersionOne(legacy);
  }
  if (version === 2) {
    return migrateVersionTwo(legacy);
  }
  if (version === 3) {
    return migrateVersionThree(legacy);
  }
  if (version === 4) {
    return migrateVersionFour(legacy);
  }
  if (version === 5) {
    return migrateVersionFive(legacy);
  }
  if (version === 6) {
    return migrateVersionSix(legacy);
  }

  throw new Error(`未対応のセーブデータ形式です: ${String(version)}`);
}

export function decodeGameState(serialized: string): GameState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("セーブデータを読み取れません");
  }

  const migrated = migrateLegacyState(parsed);
  const result = gameStateSchema.safeParse(migrated);
  if (!result.success) {
    throw new Error("セーブデータの形式が正しくありません");
  }

  return result.data as unknown as GameState;
}

export function encodeGameState(state: GameState): string {
  const result = gameStateSchema.safeParse(state);
  if (!result.success) {
    throw new Error("保存対象のゲーム状態が正しくありません");
  }

  return JSON.stringify(result.data);
}
