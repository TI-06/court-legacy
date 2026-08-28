import { z } from "zod";
import type { Player } from "../../src/domain/model/Player";
import type { PlayerId } from "../../src/domain/model/identifiers";
import type { MiddleSchoolAchievement } from "../../src/domain/scouting/scoutReport";
import type {
  CreateScoutingCandidatePoolInput,
  ScoutingCandidateInsight,
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

const overallPrecisionSchema = z.enum(["normal", "researched"]);
const potentialPrecisionSchema = z.enum([
  "normal",
  "researched",
  "appraised",
]);

const persistedPlayerSchema = z
  .object({
    id: z.string().min(1),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    abilities: z.object({}).passthrough(),
    career: z
      .object({
        schoolId: z.string().min(1),
      })
      .passthrough(),
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

const insightRowSchema = z.object({
  candidate_id: z.string().min(1),
  overall_precision: overallPrecisionSchema,
  potential_precision: potentialPrecisionSchema,
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

function mapInsight(value: unknown): ScoutingCandidateInsight {
  const parsed = insightRowSchema.safeParse(value);
  if (!parsed.success) {
    throw new ScoutingStoreDataError("scouting candidate insight is invalid", {
      cause: parsed.error,
    });
  }

  return {
    candidateId: parsed.data.candidate_id as PlayerId,
    overallPrecision: parsed.data.overall_precision,
    potentialPrecision: parsed.data.potential_precision,
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

  async listCandidateInsights(
    userId: string,
    cycleKey: string,
  ): Promise<ScoutingCandidateInsight[]> {
    const { data, error } = await this.client
      .from("scouting_candidate_insights")
      .select("candidate_id, overall_precision, potential_precision")
      .eq("user_id", userId)
      .eq("cycle_key", cycleKey);

    if (error) {
      throw new ScoutingStoreDataError("scouting candidate insight read failed", {
        cause: error,
      });
    }

    return (data ?? []).map(mapInsight);
  }
}
