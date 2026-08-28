import { z } from "zod";
import type { Player } from "../../src/domain/model/Player";
import type { School } from "../../src/domain/model/School";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import type {
  CommitRatedPvpMatchInput,
  CommittedRatedPvpMatch,
  PersistedPvpOperation,
  PublishedPvpTeamSnapshot,
  PublishPvpSnapshotInput,
  PvPStore,
  PvpHistoryEntry,
  PvpHistoryQuery,
  PvpListQuery,
  PvpOpponentQuery,
  PvpOpponentSummary,
  PvpRankingEntry,
} from "./PvPStore";
import type { SupabaseAdminClient } from "./createSupabaseAdmin";

const jsonObjectSchema = z.object({}).passthrough();

const snapshotRowSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  source_revision: z.number().int().positive(),
  source_academic_year: z.number().int(),
  source_year_index: z.number().int().nonnegative(),
  school: jsonObjectSchema,
  players: z.record(z.string(), z.unknown()),
  team_selection: jsonObjectSchema,
  is_active: z.boolean(),
  published_at: z.string().min(1),
});

const operationRowSchema = z.object({
  user_id: z.string().min(1),
  operation_id: z.string().min(1),
  kind: z.enum(["publish", "challenge"]),
  response: z.unknown(),
});

const committedMatchRowSchema = z.object({
  match_id: z.string().min(1),
  season_id: z.string().min(1),
  operation_id: z.string().min(1),
  challenger_user_id: z.string().min(1),
  defender_user_id: z.string().min(1),
  defender_snapshot_id: z.string().min(1),
  winner_user_id: z.string().min(1),
  challenger_rating_before: z.number().int().nonnegative(),
  challenger_rating_after: z.number().int().nonnegative(),
  defender_rating_before: z.number().int().nonnegative(),
  defender_rating_after: z.number().int().nonnegative(),
  result: z.unknown(),
  created_at: z.string().min(1),
});

const opponentRowSchema = z.object({
  snapshot_id: z.string().min(1),
  school_name: z.string().min(1),
  school_short_name: z.string().min(1),
  reputation_rank: z.string().min(1),
  team_power: z.number().int().min(0).max(100),
  academic_year: z.number().int(),
  published_at: z.string().min(1),
  rating: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  current_win_streak: z.number().int().nonnegative(),
});

const rankingRowSchema = z.object({
  rank: z.number().int().positive(),
  snapshot_id: z.string().min(1),
  school_name: z.string().min(1),
  school_short_name: z.string().min(1),
  rating: z.number().int().nonnegative(),
  matches: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  current_win_streak: z.number().int().nonnegative(),
});

const historyRowSchema = z.object({
  match_id: z.string().min(1),
  created_at: z.string().min(1),
  opponent_snapshot_id: z.string().min(1),
  opponent_school_name: z.string().min(1),
  outcome: z.enum(["win", "loss"]),
  rating_before: z.number().int().nonnegative(),
  rating_after: z.number().int().nonnegative(),
  result: z.unknown(),
});

export class PvPStoreDataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PvPStoreDataError";
  }
}

function parseRows<T>(
  value: unknown,
  schema: z.ZodType<T>,
  label: string,
): T[] {
  const parsed = z.array(schema).safeParse(value);
  if (!parsed.success) {
    throw new PvPStoreDataError(`${label} is invalid`, { cause: parsed.error });
  }
  return parsed.data;
}

function mapSnapshot(value: unknown): PublishedPvpTeamSnapshot {
  const parsed = snapshotRowSchema.safeParse(value);
  if (!parsed.success) {
    throw new PvPStoreDataError("PvP snapshot row is invalid", {
      cause: parsed.error,
    });
  }

  return {
    id: parsed.data.id,
    userId: parsed.data.user_id,
    sourceRevision: parsed.data.source_revision,
    sourceAcademicYear: parsed.data.source_academic_year,
    sourceYearIndex: parsed.data.source_year_index,
    school: parsed.data.school as unknown as School,
    players: parsed.data.players as Record<string, Player>,
    teamSelection: parsed.data.team_selection as unknown as TeamSelection,
    isActive: parsed.data.is_active,
    publishedAt: parsed.data.published_at,
  };
}

function throwRpcError(label: string, error: unknown): never {
  throw new PvPStoreDataError(`${label} failed`, { cause: error });
}

export class SupabasePvPStore implements PvPStore {
  constructor(private readonly client: SupabaseAdminClient) {}

  async publishSnapshot(
    input: PublishPvpSnapshotInput,
  ): Promise<PublishedPvpTeamSnapshot> {
    const { data, error } = await this.client.rpc("publish_pvp_team_snapshot", {
      p_user_id: input.userId,
      p_operation_id: input.operationId,
      p_source_revision: input.sourceRevision,
      p_source_academic_year: input.sourceAcademicYear,
      p_source_year_index: input.sourceYearIndex,
      p_school_name: input.school.name,
      p_school_short_name: input.school.shortName,
      p_reputation_rank: input.reputationRank,
      p_team_power: input.teamPower,
      p_snapshot: {
        school: input.school,
        players: input.players,
        teamSelection: input.teamSelection,
      },
    });

    if (error) {
      throwRpcError("PvP snapshot publish", error);
    }

    const rows = parseRows(data, snapshotRowSchema, "PvP publish response");
    if (rows.length !== 1) {
      throw new PvPStoreDataError("PvP publish response must contain one row");
    }
    return mapSnapshot(rows[0]);
  }

  async findChallengeOperation(
    userId: string,
    operationId: string,
  ): Promise<PersistedPvpOperation | null> {
    const { data, error } = await this.client.rpc("find_pvp_operation", {
      p_user_id: userId,
      p_operation_id: operationId,
    });

    if (error) {
      throwRpcError("PvP operation lookup", error);
    }

    const rows = parseRows(data, operationRowSchema, "PvP operation response");
    if (rows.length === 0) {
      return null;
    }
    if (rows.length !== 1) {
      throw new PvPStoreDataError("PvP operation response has duplicate rows");
    }

    const row = rows[0]!;
    return {
      userId: row.user_id,
      operationId: row.operation_id,
      kind: row.kind,
      response: row.response,
    };
  }

  async getSnapshotById(
    snapshotId: string,
  ): Promise<PublishedPvpTeamSnapshot | null> {
    const { data, error } = await this.client.rpc("get_pvp_snapshot_by_id", {
      p_snapshot_id: snapshotId,
    });

    if (error) {
      throwRpcError("PvP snapshot lookup", error);
    }

    const rows = parseRows(data, snapshotRowSchema, "PvP snapshot response");
    if (rows.length === 0) {
      return null;
    }
    if (rows.length !== 1) {
      throw new PvPStoreDataError("PvP snapshot response has duplicate rows");
    }
    return mapSnapshot(rows[0]);
  }

  async commitRatedMatch(
    input: CommitRatedPvpMatchInput,
  ): Promise<CommittedRatedPvpMatch> {
    const { data, error } = await this.client.rpc("commit_pvp_rated_match", {
      p_season_id: input.seasonId,
      p_challenge_day_key: input.challengeDayKey,
      p_operation_id: input.operationId,
      p_challenger_user_id: input.challengerUserId,
      p_defender_user_id: input.defenderUserId,
      p_defender_snapshot_id: input.defenderSnapshotId,
      p_challenger_source_revision: input.challengerSourceRevision,
      p_match_seed: input.matchSeed,
      p_challenger_won: input.challengerWon,
      p_result: input.result,
    });

    if (error) {
      throwRpcError("PvP rated match commit", error);
    }

    const rows = parseRows(
      data,
      committedMatchRowSchema,
      "PvP match commit response",
    );
    if (rows.length !== 1) {
      throw new PvPStoreDataError(
        "PvP match commit response must contain one row",
      );
    }

    const row = rows[0]!;
    return {
      matchId: row.match_id,
      seasonId: row.season_id,
      operationId: row.operation_id,
      challengerUserId: row.challenger_user_id,
      defenderUserId: row.defender_user_id,
      defenderSnapshotId: row.defender_snapshot_id,
      winnerUserId: row.winner_user_id,
      challengerRatingBefore: row.challenger_rating_before,
      challengerRatingAfter: row.challenger_rating_after,
      defenderRatingBefore: row.defender_rating_before,
      defenderRatingAfter: row.defender_rating_after,
      result: row.result,
      createdAt: row.created_at,
    };
  }

  async listOpponents(input: PvpOpponentQuery): Promise<PvpOpponentSummary[]> {
    const { data, error } = await this.client.rpc("list_pvp_opponents", {
      p_user_id: input.userId,
      p_season_id: input.seasonId,
      p_limit: input.limit,
      p_cursor: input.cursor,
    });

    if (error) {
      throwRpcError("PvP opponent query", error);
    }

    return parseRows(data, opponentRowSchema, "PvP opponent response").map(
      (row) => ({
        snapshotId: row.snapshot_id,
        schoolName: row.school_name,
        schoolShortName: row.school_short_name,
        reputationRank: row.reputation_rank,
        teamPower: row.team_power,
        academicYear: row.academic_year,
        publishedAt: row.published_at,
        rating: row.rating,
        wins: row.wins,
        losses: row.losses,
        currentWinStreak: row.current_win_streak,
      }),
    );
  }

  async listRanking(input: PvpListQuery): Promise<PvpRankingEntry[]> {
    const { data, error } = await this.client.rpc("list_pvp_ranking", {
      p_season_id: input.seasonId,
      p_limit: input.limit,
      p_cursor: input.cursor,
    });

    if (error) {
      throwRpcError("PvP ranking query", error);
    }

    return parseRows(data, rankingRowSchema, "PvP ranking response").map(
      (row) => ({
        rank: row.rank,
        snapshotId: row.snapshot_id,
        schoolName: row.school_name,
        schoolShortName: row.school_short_name,
        rating: row.rating,
        matches: row.matches,
        wins: row.wins,
        losses: row.losses,
        currentWinStreak: row.current_win_streak,
      }),
    );
  }

  async listHistory(input: PvpHistoryQuery): Promise<PvpHistoryEntry[]> {
    const { data, error } = await this.client.rpc("list_pvp_history", {
      p_user_id: input.userId,
      p_season_id: input.seasonId,
      p_limit: input.limit,
      p_cursor: input.cursor,
    });

    if (error) {
      throwRpcError("PvP history query", error);
    }

    return parseRows(data, historyRowSchema, "PvP history response").map(
      (row) => ({
        matchId: row.match_id,
        createdAt: row.created_at,
        opponentSnapshotId: row.opponent_snapshot_id,
        opponentSchoolName: row.opponent_school_name,
        outcome: row.outcome,
        ratingBefore: row.rating_before,
        ratingAfter: row.rating_after,
        result: row.result,
      }),
    );
  }
}
