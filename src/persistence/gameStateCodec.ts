import { z } from "zod";
import { createInitialTeamDynamics } from "../domain/dynamics/createInitialTeamDynamics";
import {
  CURRENT_GAME_SCHEMA_VERSION,
  createDefaultGameSettings,
  type GameState,
} from "../domain/model/GameState";
import { createDefaultTeamPlanning } from "../domain/team/teamPlanning";
import { createOfficialSeason } from "../domain/tournament/createOfficialSeason";
import { abilityKeySchema } from "../domain/validation/gameDataSchema";
import { createInitialWeeklySchedule } from "../domain/weekly/createWeeklySchedule";

const gameDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const objectSchema = z.object({}).passthrough();
const playerIdSchema = z.string().min(1);

const rotationSlotSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const teamSelectionSchema = z
  .object({
    rotation: z
      .array(
        z
          .object({
            slot: rotationSlotSchema,
            playerId: playerIdSchema,
          })
          .strict(),
      )
      .length(6),
    liberoPlayerId: playerIdSchema.nullable(),
    benchPlayerIds: z.array(playerIdSchema),
    servingOrderPlayerIds: z.array(playerIdSchema).length(6),
    substitutionPolicy: z
      .object({
        starterLockPlayerIds: z.array(playerIdSchema),
        allowFatigueBenching: z.boolean(),
        allowInjuryBenching: z.boolean(),
        automaticSubstitutions: z.boolean(),
        automaticSetChanges: z.boolean(),
      })
      .strict(),
  })
  .strict();

const savedLineupSlotSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

const teamPlanningSchema = z
  .object({
    developmentPriorityPlayerIds: z.array(playerIdSchema).max(3),
    developmentGoalsByPlayerId: z
      .record(
        playerIdSchema,
        z
          .object({
            area: z.enum(["attack", "defense", "jump", "stamina", "mental"]),
            targetGrade: z.enum(["A", "B", "C", "D", "E", "F", "G"]),
          })
          .strict(),
      )
      .optional(),
    savedLineups: z
      .array(
        z
          .object({
            slot: savedLineupSlotSchema,
            name: z.string().trim().min(1).max(24),
            selection: teamSelectionSchema,
          })
          .strict(),
      )
      .max(3),
  })
  .strict()
  .superRefine((planning, context) => {
    if (
      new Set(planning.developmentPriorityPlayerIds).size !==
      planning.developmentPriorityPlayerIds.length
    ) {
      context.addIssue({
        code: "custom",
        message: "development priority player IDs must be unique",
      });
    }
    if (
      new Set(planning.savedLineups.map((preset) => preset.slot)).size !==
      planning.savedLineups.length
    ) {
      context.addIssue({
        code: "custom",
        message: "saved lineup slots must be unique",
      });
    }
  });

const playerDevelopmentWeekPlayerSchema = z
  .object({
    playerId: playerIdSchema,
    totalAbilityGrowth: z.number().int().nonnegative(),
    abilityChanges: z.partialRecord(abilityKeySchema, z.number().int()),
  })
  .strict();

const playerDevelopmentWeekSchema = z
  .object({
    gameDate: gameDateSchema,
    academicYearIndex: z.number().int().positive(),
    weekOfYear: z.number().int().positive(),
    trainingMenuId: z.string().min(1),
    players: z.array(playerDevelopmentWeekPlayerSchema).max(64),
  })
  .strict();

const tournamentAchievementTargetSchema = z.enum([
  "prefectural-title",
  "national-appearance",
  "national-title",
]);
const seasonRanksSchema = z
  .object({
    regional: z.number().int().positive(),
    national: z.number().int().positive(),
  })
  .strict();
const seasonHistoryBaselineSchema = z
  .object({
    officialWins: z.number().int().nonnegative(),
    prefecturalTitles: z.number().int().nonnegative(),
    nationalAppearances: z.number().int().nonnegative(),
    nationalTitles: z.number().int().nonnegative(),
  })
  .strict();
const seasonGoalDefinitionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("regional-rank"),
      target: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("official-wins"),
      target: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("tournament-achievement"),
      target: z.number().int().positive(),
      achievement: tournamentAchievementTargetSchema,
    })
    .strict(),
]);
const seasonGoalStateSchema = z
  .object({
    yearIndex: z.number().int().positive(),
    academicYear: z.number().int().positive(),
    startingRanks: seasonRanksSchema,
    rankingTotals: seasonRanksSchema,
    baseline: seasonHistoryBaselineSchema,
    goals: z.array(seasonGoalDefinitionSchema).length(3),
  })
  .strict();
const seasonGoalResultSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("regional-rank"),
      target: z.number().int().positive(),
      progress: z.number().int().nonnegative(),
      achieved: z.boolean(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("official-wins"),
      target: z.number().int().positive(),
      progress: z.number().int().nonnegative(),
      achieved: z.boolean(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("tournament-achievement"),
      target: z.number().int().positive(),
      achievement: tournamentAchievementTargetSchema,
      progress: z.number().int().nonnegative(),
      achieved: z.boolean(),
    })
    .strict(),
]);
const seasonGoalSeasonSummarySchema = z
  .object({
    yearIndex: z.number().int().positive(),
    academicYear: z.number().int().positive(),
    startingRanks: seasonRanksSchema,
    finalRanks: seasonRanksSchema,
    deltas: seasonHistoryBaselineSchema,
    goalResults: z.array(seasonGoalResultSchema).length(3),
    achievedCount: z.number().int().min(0).max(3),
  })
  .strict();

const specialRelationshipKindSchema = z.enum(["rival", "mentor", "partner"]);
const relationshipPlayerPairSchema = z.tuple([playerIdSchema, playerIdSchema]);
const relationshipTagBase = {
  establishedDate: gameDateSchema,
  sourceEventId: z.string().min(1).nullable(),
  lastReinforcedDate: gameDateSchema,
  belowThresholdSince: gameDateSchema.nullable(),
};
const specialRelationshipTagSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("rival"),
      ...relationshipTagBase,
    })
    .strict(),
  z
    .object({
      kind: z.literal("partner"),
      ...relationshipTagBase,
    })
    .strict(),
  z
    .object({
      kind: z.literal("mentor"),
      ...relationshipTagBase,
      mentorPlayerId: playerIdSchema,
      protegePlayerId: playerIdSchema,
    })
    .strict(),
]);

const playerRelationshipBondSchema = z
  .object({
    playerIds: relationshipPlayerPairSchema,
    tags: z.array(specialRelationshipTagSchema).max(2),
  })
  .strict()
  .superRefine((bond, context) => {
    const [leftId, rightId] = bond.playerIds;
    if (leftId === rightId) {
      context.addIssue({
        code: "custom",
        message: "relationship pair must contain two different players",
      });
    }
    if (new Set(bond.tags.map((tag) => tag.kind)).size !== bond.tags.length) {
      context.addIssue({
        code: "custom",
        message: "relationship tags must have unique kinds",
      });
    }
    for (const tag of bond.tags) {
      if (tag.kind !== "mentor") continue;
      if (
        tag.mentorPlayerId === tag.protegePlayerId ||
        !bond.playerIds.includes(tag.mentorPlayerId) ||
        !bond.playerIds.includes(tag.protegePlayerId)
      ) {
        context.addIssue({
          code: "custom",
          message: "mentor direction must reference both players in the pair",
        });
      }
    }
  });

const playerRelationshipBondsSchema = z
  .record(z.string().min(1), playerRelationshipBondSchema)
  .superRefine((bonds, context) => {
    for (const [key, bond] of Object.entries(bonds)) {
      const canonicalKey = [...bond.playerIds].sort().join("::");
      if (key !== canonicalKey) {
        context.addIssue({
          code: "custom",
          message: "relationship bond key must match its canonical player pair",
        });
      }
    }
  });

const relationshipLegacyRecordSchema = z
  .object({
    playerIds: relationshipPlayerPairSchema,
    displayNames: z.tuple([z.string().min(1), z.string().min(1)]),
    tags: z.array(specialRelationshipTagSchema).max(2),
    finalRelationshipScore: z.number().min(0).max(100),
    archivedDate: gameDateSchema,
  })
  .strict()
  .superRefine((record, context) => {
    if (
      new Set(record.tags.map((tag) => tag.kind)).size !== record.tags.length
    ) {
      context.addIssue({
        code: "custom",
        message: "legacy relationship tags must have unique kinds",
      });
    }
    for (const tag of record.tags) {
      if (tag.kind !== "mentor") continue;
      if (
        tag.mentorPlayerId === tag.protegePlayerId ||
        !record.playerIds.includes(tag.mentorPlayerId) ||
        !record.playerIds.includes(tag.protegePlayerId)
      ) {
        context.addIssue({
          code: "custom",
          message: "legacy mentor direction must reference both players",
        });
      }
    }
  });

const gameHistorySchema = z
  .object({
    playerDevelopmentWeeks: z.array(playerDevelopmentWeekSchema).max(52),
    relationshipLegacyHistory: z.array(relationshipLegacyRecordSchema).max(200),
    seasonGoalSeasons: z
      .array(seasonGoalSeasonSummarySchema)
      .max(30)
      .optional(),
  })
  .passthrough();

const gameSettingsSchema = z.object({
  matchDisplayMode: z.enum(["normal", "fast", "text", "instant"]),
  matchPlaybackSpeed: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  reducedMotion: z.boolean(),
  confirmBeforeOfficialMatch: z.boolean(),
  autosaveEnabled: z.boolean(),
});

const recruitingStateSchema = z
  .object({
    cycleKey: z.string().min(1),
    committedCandidateIds: z.array(z.string().min(1)),
    visitActionsUsed: z.number().int().min(0).max(4).optional(),
    recommendationUsed: z.boolean().optional(),
    candidateEngagements: z
      .record(
        z.string().min(1),
        z
          .object({
            interestBonus: z.number().int().min(0).max(100),
            visits: z.number().int().min(0).max(4),
            recommendationUsed: z.boolean(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

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

const socialGrowthContributionSchema = z
  .object({
    code: z.enum([
      "relationship-partner",
      "relationship-mentor",
      "relationship-rival",
    ]),
    label: z.string().min(1),
    percentPoints: z.union([z.literal(3), z.literal(4)]),
    relatedPlayerId: playerIdSchema,
  })
  .strict();

const relationshipTrainingModifierSummarySchema = z
  .object({
    contributions: z.array(socialGrowthContributionSchema).max(64),
    rawPercentPoints: z.number().int().nonnegative(),
    appliedPercentPoints: z.number().int().min(0).max(5),
    capped: z.boolean(),
  })
  .strict();

const emptyRelationshipTrainingModifierSummary = {
  contributions: [],
  rawPercentPoints: 0,
  appliedPercentPoints: 0,
  capped: false,
};

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
    socialGrowth: relationshipTrainingModifierSummarySchema.default(
      emptyRelationshipTrainingModifierSummary,
    ),
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

const concernResolutionNotificationSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("concern-resolution"),
    createdGameDate: gameDateSchema,
    academicYearIndex: z.number().int().positive(),
    weekOfYear: z.number().int().positive(),
    readAtGameDate: gameDateSchema.nullable(),
    payload: z
      .object({
        items: z
          .array(
            z
              .object({
                playerId: playerIdSchema,
                displayName: z.string().min(1),
                concernCode: z.enum([
                  "playing-time",
                  "role-mismatch",
                  "injury-overuse",
                  "team-slump",
                ]),
                concernTitle: z.string().min(1),
              })
              .strict(),
          )
          .max(64),
      })
      .strict(),
  })
  .strict();

const specialRelationshipNotificationSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("special-relationship"),
    createdGameDate: gameDateSchema,
    academicYearIndex: z.number().int().positive(),
    weekOfYear: z.number().int().positive(),
    readAtGameDate: gameDateSchema.nullable(),
    payload: z
      .object({
        action: z.enum(["established", "removed"]),
        kind: specialRelationshipKindSchema,
        kindLabel: z.string().min(1),
        playerIds: relationshipPlayerPairSchema,
        displayNames: z.tuple([z.string().min(1), z.string().min(1)]),
      })
      .strict(),
  })
  .strict();

const characterTraitDiscoveredNotificationSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("character-trait-discovered"),
    createdGameDate: gameDateSchema,
    academicYearIndex: z.number().int().positive(),
    weekOfYear: z.number().int().positive(),
    readAtGameDate: gameDateSchema.nullable(),
    payload: z
      .object({
        playerId: playerIdSchema,
        displayName: z.string().min(1),
        traitId: z.string().min(1),
        traitName: z.string().min(1),
        description: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const gameNotificationSchema = z.discriminatedUnion("type", [
  trainingResultNotificationSchema,
  concernResolutionNotificationSchema,
  specialRelationshipNotificationSchema,
  characterTraitDiscoveredNotificationSchema,
]);

const notificationStateSchema = z
  .object({
    items: z.array(gameNotificationSchema).max(20),
  })
  .strict()
  .transform((state) => ({
    items: state.items.filter(
      (item, index, items) =>
        !items
          .slice(index + 1)
          .some((candidate) => candidate.type === item.type),
    ),
  }));

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

const legacyPracticeIncomingOfferHistoryEntrySchema = z
  .object({
    schoolId: z.string().min(1),
    date: gameDateSchema,
  })
  .strict();

const incomingPracticeOfferHistoryEntrySchema = z
  .object({
    schoolId: z.string().min(1),
    surfacedDate: gameDateSchema,
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
        incomingOfferHistory: z
          .array(legacyPracticeIncomingOfferHistoryEntrySchema)
          .max(24)
          .optional(),
      })
      .strict(),
    incomingPracticeOfferHistory: z
      .array(incomingPracticeOfferHistoryEntrySchema)
      .max(32)
      .optional(),
    recentPracticeMatches: z.array(practiceMatchHistoryEntrySchema).max(12),
    latestReport: weeklyReportSchema.nullable(),
  })
  .strict()
  .transform((state) => {
    const legacyHistory = state.practiceMatch.incomingOfferHistory ?? [];
    const incomingPracticeOfferHistory =
      state.incomingPracticeOfferHistory ??
      legacyHistory.map((entry) => ({
        schoolId: entry.schoolId,
        surfacedDate: entry.date,
      }));
    const practiceMatch = { ...state.practiceMatch };
    delete practiceMatch.incomingOfferHistory;
    return {
      ...state,
      practiceMatch,
      incomingPracticeOfferHistory,
    };
  });

const persistedPlayerSchema = z
  .object({
    hiddenTraitIds: z.array(z.string().min(1)),
    revealedHiddenTraitIds: z.array(z.string().min(1)),
    hiddenTraitAssignmentInitialized: z.boolean(),
  })
  .passthrough()
  .superRefine((player, context) => {
    const hidden = new Set(player.hiddenTraitIds);
    if (player.revealedHiddenTraitIds.some((traitId) => !hidden.has(traitId))) {
      context.addIssue({
        code: "custom",
        message: "revealed hidden traits must be assigned hidden traits",
      });
    }
  });

const eventMemorySchema = z
  .object({
    recentActorPairKeys: z.array(z.string().min(1)).max(6),
  })
  .passthrough();

const gameStateSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_GAME_SCHEMA_VERSION),
    seed: z.string().min(1),
    randomCursor: z.number().int().nonnegative(),
    date: gameDateSchema,
    yearIndex: z.number().int().positive(),
    userSchoolId: z.string().min(1),
    schools: z.record(z.string(), objectSchema),
    players: z.record(z.string(), persistedPlayerSchema),
    playerRelationships: z.record(z.string(), z.number().min(0).max(100)),
    playerRelationshipBonds: playerRelationshipBondsSchema,
    calendar: objectSchema,
    activeMatch: z.unknown().nullable(),
    pendingEvent: z.unknown().nullable(),
    history: gameHistorySchema,
    eventMemory: eventMemorySchema,
    settings: gameSettingsSchema,
    world: objectSchema,
    officialSeason: objectSchema,
    teamDynamics: teamDynamicsSchema,
    weeklySchedule: weeklyScheduleSchema,
    notifications: notificationStateSchema,
    schoolManagement: schoolManagementSchema,
    teamPlanning: teamPlanningSchema,
    seasonGoals: seasonGoalStateSchema.optional(),
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

function historyObject(history: unknown): Record<string, unknown> {
  return history && typeof history === "object" && !Array.isArray(history)
    ? (history as Record<string, unknown>)
    : {};
}

function historyWithOfficialTournaments(
  history: unknown,
): Record<string, unknown> {
  return {
    ...historyObject(history),
    officialTournaments: [],
  };
}

function migrateVersionEight(legacy: Record<string, unknown>): unknown {
  const legacyPlayers =
    legacy.players &&
    typeof legacy.players === "object" &&
    !Array.isArray(legacy.players)
      ? (legacy.players as Record<string, unknown>)
      : {};
  const players = Object.fromEntries(
    Object.entries(legacyPlayers).map(([id, value]) => {
      const player =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};
      return [
        id,
        {
          ...player,
          revealedHiddenTraitIds: [],
          hiddenTraitAssignmentInitialized: false,
        },
      ];
    }),
  );
  const eventMemory =
    legacy.eventMemory &&
    typeof legacy.eventMemory === "object" &&
    !Array.isArray(legacy.eventMemory)
      ? (legacy.eventMemory as Record<string, unknown>)
      : {};

  return {
    ...legacy,
    schemaVersion: CURRENT_GAME_SCHEMA_VERSION,
    players,
    playerRelationshipBonds: {},
    history: {
      ...historyObject(legacy.history),
      relationshipLegacyHistory: [],
    },
    eventMemory: {
      ...eventMemory,
      recentActorPairKeys: [],
    },
  };
}

function migrateVersionSeven(legacy: Record<string, unknown>): unknown {
  return migrateVersionEight({
    ...legacy,
    schemaVersion: 8,
    history: {
      ...historyObject(legacy.history),
      playerDevelopmentWeeks: [],
    },
    teamPlanning: createDefaultTeamPlanning(),
  });
}

function migrateVersionSix(legacy: Record<string, unknown>): unknown {
  const yearIndex =
    typeof legacy.yearIndex === "number" && Number.isInteger(legacy.yearIndex)
      ? legacy.yearIndex
      : 1;
  return migrateVersionSeven({
    ...legacy,
    schemaVersion: 7,
    schoolManagement: {
      assistantCoach: null,
      fundsHistory: [],
      lastAnnualBudgetYearIndex: yearIndex,
    },
  });
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
  if (version === 7) {
    return migrateVersionSeven(legacy);
  }
  if (version === 8) {
    return migrateVersionEight(legacy);
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
