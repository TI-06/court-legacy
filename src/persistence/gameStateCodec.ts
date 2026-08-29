import { z } from "zod";
import { createInitialTeamDynamics } from "../domain/dynamics/createInitialTeamDynamics";
import {
  CURRENT_GAME_SCHEMA_VERSION,
  createDefaultGameSettings,
  type GameState,
} from "../domain/model/GameState";
import { createOfficialSeason } from "../domain/tournament/createOfficialSeason";

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

function migrateVersionThree(legacy: Record<string, unknown>): unknown {
  const migrated = {
    ...legacy,
    schemaVersion: CURRENT_GAME_SCHEMA_VERSION,
  };

  return {
    ...migrated,
    teamDynamics: createInitialTeamDynamics(
      migrated as unknown as InitialDynamicsSource,
    ),
  };
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
