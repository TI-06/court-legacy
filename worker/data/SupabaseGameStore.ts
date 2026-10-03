import { z } from "zod";
import {
  CURRENT_GAME_SCHEMA_VERSION,
  type GameState,
} from "../../src/domain/model/GameState";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import { validateTeamSelection } from "../../src/domain/team/validateTeamSelection";
import { decodeGameState } from "../../src/persistence/gameStateCodec";
import type {
  CloudGameSnapshot,
  CreateCloudGameInput,
  GameStore,
  PersistedOperationResponse,
  PersistOperationInput,
  PersistOperationResult,
} from "./GameStore";
import {
  GameAlreadyExistsError,
  GameStoreDataError,
  RevisionConflictError,
} from "./GameStore";
import type { SupabaseAdminClient } from "./createSupabaseAdmin";
import {
  buildJsonStatePatch,
  compactJsonStatePatchForPersistence,
} from "./statePatch";

const rotationSlotSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const teamSelectionSchema = z.object({
  rotation: z
    .array(
      z.object({
        slot: rotationSlotSchema,
        playerId: z.string().min(1),
      }),
    )
    .length(6),
  liberoPlayerId: z.string().min(1).nullable(),
  benchPlayerIds: z.array(z.string().min(1)),
  servingOrderPlayerIds: z.array(z.string().min(1)).length(6),
  substitutionPolicy: z.object({
    starterLockPlayerIds: z.array(z.string().min(1)),
    allowFatigueBenching: z.boolean(),
    allowInjuryBenching: z.boolean(),
    automaticSubstitutions: z.boolean(),
    automaticSetChanges: z.boolean(),
  }),
});

const saveRowSchema = z.object({
  user_id: z.string().min(1),
  school_id: z.string().min(1),
  revision: z.number().int().positive(),
  state: z.unknown(),
  team_selection: z.unknown(),
});

const createGameRpcSchema = z
  .array(
    z.object({
      school_id: z.string().min(1),
      revision: z.number().int().positive(),
    }),
  )
  .min(1);

const storedOperationSchema = z.object({
  response: z.unknown(),
  resulting_revision: z.number().int().positive(),
});

const MAX_JSON_PATCH_BYTES = 32_768;
const MAX_PREFERRED_JSON_PATCH_BYTES = 262_144;
// Each JSONB patch operation rewrites part of the canonical save inside
// Postgres. Production saves above 1 MB have shown that allowing dozens of
// operations can hit the API's statement timeout even when the request body is
// much smaller than a full-state save. Keep a hard operation ceiling that
// preferDelta cannot bypass.
const MAX_JSON_PATCH_OPERATIONS = 16;

const applyOperationRpcSchema = z
  .array(
    z.object({
      response: z.unknown(),
      replayed: z.boolean(),
    }),
  )
  .min(1);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCurrentStoredState(value: unknown): value is GameState {
  if (!isRecord(value) || value.schemaVersion !== CURRENT_GAME_SCHEMA_VERSION) {
    return false;
  }

  return (
    typeof value.seed === "string" &&
    typeof value.randomCursor === "number" &&
    typeof value.date === "string" &&
    typeof value.yearIndex === "number" &&
    typeof value.userSchoolId === "string" &&
    isRecord(value.schools) &&
    isRecord(value.players) &&
    isRecord(value.playerRelationships) &&
    isRecord(value.playerRelationshipBonds) &&
    isRecord(value.calendar) &&
    Object.prototype.hasOwnProperty.call(value, "activeMatch") &&
    Object.prototype.hasOwnProperty.call(value, "pendingEvent") &&
    isRecord(value.history) &&
    isRecord(value.eventMemory) &&
    isRecord(value.settings) &&
    isRecord(value.world) &&
    isRecord(value.officialSeason) &&
    isRecord(value.teamDynamics) &&
    isRecord(value.weeklySchedule) &&
    isRecord(value.notifications) &&
    isRecord(value.schoolManagement) &&
    isRecord(value.teamPlanning)
  );
}

function decodeStoredState(value: unknown): GameState {
  if (isCurrentStoredState(value)) {
    return value;
  }

  try {
    return decodeGameState(JSON.stringify(value));
  } catch (error) {
    throw new GameStoreDataError("cloud game state is invalid", {
      cause: error,
    });
  }
}

function decodeStoredSelection(
  value: unknown,
  state: GameState,
): TeamSelection {
  const parsed = teamSelectionSchema.safeParse(value);
  if (!parsed.success) {
    throw new GameStoreDataError("cloud team selection is invalid", {
      cause: parsed.error,
    });
  }

  const selection = parsed.data as TeamSelection;
  const issues = validateTeamSelection({
    state,
    schoolId: state.userSchoolId,
    selection,
  });
  if (issues.length > 0) {
    throw new GameStoreDataError(
      `cloud team selection is inconsistent: ${issues[0]!.code}`,
    );
  }

  return selection;
}

function mapSnapshot(value: unknown): CloudGameSnapshot {
  const parsed = saveRowSchema.safeParse(value);
  if (!parsed.success) {
    throw new GameStoreDataError("cloud save row is invalid", {
      cause: parsed.error,
    });
  }

  const state = decodeStoredState(parsed.data.state);
  const teamSelection = decodeStoredSelection(
    parsed.data.team_selection,
    state,
  );

  return {
    userId: parsed.data.user_id,
    schoolDbId: parsed.data.school_id,
    revision: parsed.data.revision,
    state,
    teamSelection,
  };
}

function mapOperationResponse(value: unknown): PersistedOperationResponse {
  const parsed = z
    .object({
      operationId: z.string().min(1),
      game: z.object({
        userId: z.string().min(1),
        schoolDbId: z.string().min(1),
        revision: z.number().int().positive(),
        state: z.unknown(),
        teamSelection: z.unknown(),
      }),
      outcome: z.unknown().optional(),
    })
    .safeParse(value);
  if (!parsed.success) {
    throw new GameStoreDataError("stored operation response is invalid", {
      cause: parsed.error,
    });
  }

  const state = decodeStoredState(parsed.data.game.state);
  const teamSelection = decodeStoredSelection(
    parsed.data.game.teamSelection,
    state,
  );
  const response: PersistedOperationResponse = {
    operationId: parsed.data.operationId,
    game: {
      userId: parsed.data.game.userId,
      schoolDbId: parsed.data.game.schoolDbId,
      revision: parsed.data.game.revision,
      state,
      teamSelection,
    },
  };
  if (parsed.data.outcome !== undefined) {
    response.outcome = parsed.data.outcome;
  }
  return response;
}

function isRevisionConflict(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.message?.includes("revision_conflict") === true ||
    error.code === "40001"
  );
}

export class SupabaseGameStore implements GameStore {
  constructor(private readonly client: SupabaseAdminClient) {}

  async getSnapshot(userId: string): Promise<CloudGameSnapshot | null> {
    const { data, error } = await this.client
      .from("game_saves")
      .select("user_id, school_id, revision, state, team_selection")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new GameStoreDataError("cloud save read failed", { cause: error });
    }
    if (!data) {
      return null;
    }

    return mapSnapshot(data);
  }

  async getOperationResponse(
    userId: string,
    operationId: string,
  ): Promise<PersistedOperationResponse | null> {
    const { data, error } = await this.client
      .from("game_operations")
      .select("response, resulting_revision")
      .eq("user_id", userId)
      .eq("operation_id", operationId)
      .maybeSingle();

    if (error) {
      throw new GameStoreDataError("operation replay lookup failed", {
        cause: error,
      });
    }
    if (!data) {
      return null;
    }

    const row = storedOperationSchema.safeParse(data);
    if (!row.success) {
      throw new GameStoreDataError("stored operation row is invalid", {
        cause: row.error,
      });
    }

    // Legacy rows contain the complete response and remain readable during
    // rolling deployment. V3 rows are intentionally compact.
    const legacy = z.object({ game: z.unknown() }).safeParse(row.data.response);
    if (legacy.success) {
      return mapOperationResponse(row.data.response);
    }

    const compact = z
      .object({
        operationId: z.string().min(1),
        resultingRevision: z.number().int().positive(),
        outcome: z.unknown().optional(),
      })
      .safeParse(row.data.response);
    if (!compact.success) {
      throw new GameStoreDataError("stored compact operation is invalid", {
        cause: compact.error,
      });
    }

    const snapshot = await this.getSnapshot(userId);
    if (!snapshot || snapshot.revision !== row.data.resulting_revision) {
      return null;
    }
    const response: PersistedOperationResponse = {
      operationId: compact.data.operationId,
      game: snapshot,
    };
    if (compact.data.outcome !== undefined) {
      response.outcome = compact.data.outcome;
    }
    return response;
  }

  async createGame(input: CreateCloudGameInput): Promise<CloudGameSnapshot> {
    const { data, error } = await this.client.rpc("create_v2_game", {
      p_user_id: input.userId,
      p_display_name: input.displayName,
      p_school_name: input.schoolName,
      p_school_short_name: input.schoolShortName,
      p_coach_name: input.coachName,
      p_region_id: input.regionId,
      p_state: input.state,
      p_team_selection: input.teamSelection,
    });

    if (error?.code === "23505") {
      throw new GameAlreadyExistsError();
    }
    if (error) {
      throw new GameStoreDataError("cloud game creation failed", {
        cause: error,
      });
    }

    const parsed = createGameRpcSchema.safeParse(data);
    if (!parsed.success) {
      throw new GameStoreDataError("cloud game creation response is invalid", {
        cause: parsed.error,
      });
    }

    const result = parsed.data[0]!;
    return {
      userId: input.userId,
      schoolDbId: result.school_id,
      revision: result.revision,
      state: input.state,
      teamSelection: input.teamSelection,
    };
  }

  async applyOperation(
    input: PersistOperationInput,
  ): Promise<PersistOperationResult> {
    const rawStatePatch =
      input.statePatch ?? buildJsonStatePatch(input.previousState, input.state);
    const statePatch = compactJsonStatePatchForPersistence(
      input.state as unknown as Record<string, unknown>,
      rawStatePatch,
      MAX_JSON_PATCH_OPERATIONS,
    );
    const patchBytes = JSON.stringify(statePatch).length;
    const exceedsOperationSafetyLimit =
      statePatch.length > MAX_JSON_PATCH_OPERATIONS;
    const exceedsNormalDeltaBudget = patchBytes > MAX_JSON_PATCH_BYTES;
    const exceedsPreferredDeltaBudget =
      input.preferDelta && patchBytes > MAX_PREFERRED_JSON_PATCH_BYTES;
    const useFullStateFallback =
      exceedsOperationSafetyLimit ||
      exceedsPreferredDeltaBudget ||
      (!input.preferDelta && exceedsNormalDeltaBudget);
    const { data, error } = useFullStateFallback
      ? await this.client.rpc("apply_game_operation_v3", {
          p_user_id: input.userId,
          p_operation_id: input.operationId,
          p_expected_revision: input.expectedRevision,
          p_state: input.state,
          p_team_selection: input.teamSelection,
          p_outcome: input.response.outcome ?? null,
        })
      : await this.client.rpc("apply_game_operation_v4", {
          p_user_id: input.userId,
          p_operation_id: input.operationId,
          p_expected_revision: input.expectedRevision,
          p_state_patch: statePatch,
          p_team_selection: input.teamSelection,
          p_outcome: input.response.outcome ?? null,
        });

    if (error && isRevisionConflict(error)) {
      throw new RevisionConflictError();
    }
    if (error) {
      throw new GameStoreDataError("cloud game operation failed", {
        cause: error,
      });
    }

    const parsed = applyOperationRpcSchema.safeParse(data);
    if (!parsed.success) {
      throw new GameStoreDataError("game operation response is invalid", {
        cause: parsed.error,
      });
    }

    const result = parsed.data[0]!;
    if (!result.replayed) {
      return {
        response: input.response,
        replayed: false,
      };
    }
    if (result.response == null) {
      throw new GameStoreDataError(
        "replayed game operation response is missing",
      );
    }
    const compact = z
      .object({
        operationId: z.string().min(1),
        resultingRevision: z.number().int().positive(),
        outcome: z.unknown().optional(),
      })
      .safeParse(result.response);
    if (!compact.success) {
      return {
        response: mapOperationResponse(result.response),
        replayed: true,
      };
    }
    if (
      compact.data.operationId !== input.operationId ||
      compact.data.resultingRevision !== input.expectedRevision + 1
    ) {
      throw new RevisionConflictError();
    }
    return {
      response: input.response,
      replayed: true,
    };
  }

  async resetGameData(userId: string): Promise<void> {
    const deleteUserRows = async (table: string) => {
      const { error } = await this.client
        .from(table)
        .delete()
        .eq("user_id", userId);
      if (error) {
        throw new GameStoreDataError(`game reset failed for ${table}`, {
          cause: error,
        });
      }
    };

    const { error: pvpMatchError } = await this.client
      .from("pvp_matches")
      .delete()
      .or(
        `challenger_user_id.eq.${userId},defender_user_id.eq.${userId},winner_user_id.eq.${userId}`,
      );
    if (pvpMatchError) {
      throw new GameStoreDataError("game reset failed for pvp_matches", {
        cause: pvpMatchError,
      });
    }

    for (const table of [
      "shop_item_uses",
      "shop_transactions",
      "shop_operations",
      "shop_inventory",
      "shop_yearly_counters",
      "scouting_candidate_insights",
      "scouting_candidate_pools",
      "pvp_operations",
      "pvp_ratings",
      "pvp_team_snapshots",
      "game_operations",
      "game_saves",
      "schools",
    ]) {
      await deleteUserRows(table);
    }
  }
}
