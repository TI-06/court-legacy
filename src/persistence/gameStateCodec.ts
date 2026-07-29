import { z } from "zod";
import {
  CURRENT_GAME_SCHEMA_VERSION,
  createDefaultGameSettings,
  type GameState,
} from "../domain/model/GameState";

const gameDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const objectSchema = z.object({}).passthrough();

const gameSettingsSchema = z.object({
  matchDisplayMode: z.enum(["normal", "fast", "text", "instant"]),
  matchPlaybackSpeed: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  reducedMotion: z.boolean(),
  confirmBeforeOfficialMatch: z.boolean(),
  autosaveEnabled: z.boolean(),
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
    calendar: objectSchema,
    activeMatch: z.unknown().nullable(),
    pendingEvent: z.unknown().nullable(),
    history: objectSchema,
    eventMemory: objectSchema,
    settings: gameSettingsSchema,
    world: objectSchema,
  })
  .passthrough();

const versionProbeSchema = z
  .object({
    schemaVersion: z.number().int().nonnegative(),
  })
  .passthrough();

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

  if (version === 0) {
    const legacy = value as Record<string, unknown>;
    const legacySettings =
      legacy.settings && typeof legacy.settings === "object"
        ? (legacy.settings as Record<string, unknown>)
        : {};

    return {
      ...legacy,
      schemaVersion: CURRENT_GAME_SCHEMA_VERSION,
      settings: {
        ...createDefaultGameSettings(),
        ...legacySettings,
      },
    };
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
