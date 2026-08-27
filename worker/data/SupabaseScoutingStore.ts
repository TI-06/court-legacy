import { z } from "zod";
import type { Player } from "../../src/domain/model/Player";
import type { MiddleSchoolAchievement } from "../../src/domain/scouting/scoutReport";
import type {
  CreateScoutingCandidatePoolInput,
  ScoutingCandidatePool,
  ScoutingStore,
} from "./ScoutingStore";
import type { SupabaseAdminClient } from "./createSupabaseAdmin";

const achievementSchema = z.enum([
  "unknown",
  "regional-starter",
  "prefectural-best-eight",
  "prefectural-selection",
  "national-event",
]);

const persistedPlayerSchema = z
  .object({
    id: z.string().min(1),
    schoolId: z.string().min(1),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    abilities: z.object({}).passthrough(),
  })
  .passthrough();

const candidateSchema = z.object({
  player: persistedPlayerSchema,
  middleSchoolAchievement: achievementSchema,
});

const poolRowSchema = z.object({
  user_id: z.string().min(1),
  cycle_key: z.string().min(1),
  creation_operation_id: z.string().min(1),
  candidates: z.array(candidateSchema).min(1),
});

const createPoolRpcSchema = z.array(poolRowSchema).min(1);

export class ScoutingStoreDataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ScoutingStoreDataError";
  }
}

function mapPool(value: unknown): ScoutingCandidatePool {
  const parsed = poolRowSchema.safeParse(value);
  if (!parsed.success) {
    throw new ScoutingStoreDataError("scouting candidate pool is invalid", {
      cause: parsed.error,
    });
  }

  return {
    userId: parsed.data.user_id,
    cycleKey: parsed.data.cycle_key,
    creationOperationId: parsed.data.creation_operation_id,
    candidates: parsed.data.candidates.map((candidate) => ({
      player: candidate.player as unknown as Player,
      middleSchoolAchievement:
        candidate.middleSchoolAchievement as MiddleSchoolAchievement,
    })),
  };
}

export class SupabaseScoutingStore implements ScoutingStore {
  constructor(private readonly client: SupabaseAdminClient) {}

  async getCandidatePool(
    userId: string,
    cycleKey: string,
  ): Promise<ScoutingCandidatePool | null> {
    const { data, error } = await this.client
      .from("scouting_candidate_pools")
      .select("user_id, cycle_key, creation_operation_id, candidates")
      .eq("user_id", userId)
      .eq("cycle_key", cycleKey)
      .maybeSingle();

    if (error) {
      throw new ScoutingStoreDataError("scouting candidate pool read failed", {
        cause: error,
      });
    }
    if (!data) {
      return null;
    }

    return mapPool(data);
  }

  async createCandidatePool(
    input: CreateScoutingCandidatePoolInput,
  ): Promise<ScoutingCandidatePool> {
    const { data, error } = await this.client.rpc(
      "create_scouting_candidate_pool",
      {
        p_user_id: input.userId,
        p_cycle_key: input.cycleKey,
        p_creation_operation_id: input.creationOperationId,
        p_candidates: input.candidates,
      },
    );

    if (error) {
      throw new ScoutingStoreDataError(
        "scouting candidate pool creation failed",
        {
          cause: error,
        },
      );
    }

    const parsed = createPoolRpcSchema.safeParse(data);
    if (!parsed.success) {
      throw new ScoutingStoreDataError(
        "scouting candidate pool creation response is invalid",
        { cause: parsed.error },
      );
    }

    return mapPool(parsed.data[0]);
  }
}
