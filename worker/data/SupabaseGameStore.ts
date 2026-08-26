import { z } from "zod";
import type { GameState } from "../../src/domain/model/GameState";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import { validateTeamSelection } from "../../src/domain/team/validateTeamSelection";
import { decodeGameState } from "../../src/persistence/gameStateCodec";
import type {
  CloudGameSnapshot,
  CreateCloudGameInput,
  GameStore,
} from "./GameStore";
import {
  GameAlreadyExistsError,
  GameStoreDataError,
} from "./GameStore";
import type { SupabaseAdminClient } from "./createSupabaseAdmin";

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

function decodeStoredState(value: unknown): GameState {
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
  const teamSelection = decodeStoredSelection(parsed.data.team_selection, state);

  return {
    userId: parsed.data.user_id,
    schoolDbId: parsed.data.school_id,
    revision: parsed.data.revision,
    state,
    teamSelection,
  };
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

  async applyOperation(): Promise<CloudGameSnapshot> {
    throw new Error("revisioned game operations are not enabled yet");
  }
}
