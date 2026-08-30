import { z } from "zod";
import { pvpJstDayKey, pvpSeasonId } from "../../src/domain/pvp/season";
import type { GameStore } from "../data/GameStore";
import type { PvPStore, PublishedPvpTeamSnapshot } from "../data/PvPStore";
import { json, jsonError } from "../http/json";
import { simulatePvpMatch } from "../pvp/simulatePvpMatch";
import type { AuthenticatedRequestHandler } from "../router";

const requestSchema = z
  .object({
    operationId: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(1).max(120)),
    revision: z.number().int().positive(),
    opponentSnapshotId: z.string().uuid(),
  })
  .strict();

const publicResultSchema = z
  .object({
    outcome: z.enum(["win", "loss"]),
    challengerSetsWon: z.number().int().min(0).max(2),
    defenderSetsWon: z.number().int().min(0).max(2),
    sets: z.array(
      z
        .object({
          setNumber: z.number().int().positive(),
          challengerScore: z.number().int().nonnegative(),
          defenderScore: z.number().int().nonnegative(),
        })
        .strict(),
    ),
  })
  .strip();

const responseSchema = z
  .object({
    operationId: z.string().min(1).max(120),
    revision: z.number().int().positive(),
    seasonId: z.string().regex(/^\d{4}-\d{2}$/),
    matchId: z.string().min(1),
    opponent: z
      .object({
        snapshotId: z.string().min(1),
        schoolName: z.string().min(1),
        schoolShortName: z.string().min(1),
      })
      .strict(),
    rating: z
      .object({
        before: z.number().int().nonnegative(),
        after: z.number().int().nonnegative(),
        delta: z.number().int(),
      })
      .strict(),
    result: publicResultSchema,
    createdAt: z.string().min(1),
  })
  .strict();

export interface PvpChallengeHandlerDependencies {
  gameStore: GameStore;
  pvpStore: PvPStore;
  now?: () => Date;
  createMatchNonce?: () => string;
}

function invalidRequest(): Response {
  return jsonError(
    400,
    "invalid_pvp_challenge_request",
    "対戦条件を確認してください",
  );
}

function revisionConflict(): Response {
  return jsonError(
    409,
    "revision_conflict",
    "別の端末または操作でデータが更新されています",
  );
}

function operationConflict(): Response {
  return jsonError(
    409,
    "pvp_operation_conflict",
    "同じ操作IDが別の対人戦操作で使用されています",
  );
}

function containsErrorCode(error: unknown, code: string, depth = 0): boolean {
  if (depth > 4 || error == null) return false;
  if (typeof error === "string") return error.includes(code);
  if (error instanceof Error) {
    return (
      error.message.includes(code) ||
      containsErrorCode(error.cause, code, depth + 1)
    );
  }
  if (typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      code?: unknown;
      cause?: unknown;
    };
    return (
      (typeof candidate.message === "string" &&
        candidate.message.includes(code)) ||
      candidate.code === code ||
      containsErrorCode(candidate.cause, code, depth + 1)
    );
  }
  return false;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createMatchSeed(input: {
  challengerUserId: string;
  defenderSnapshotId: string;
  operationId: string;
  revision: number;
  seasonId: string;
  challengeDayKey: string;
  nonce: string;
}): Promise<string> {
  const material = [
    input.challengerUserId,
    input.defenderSnapshotId,
    input.operationId,
    String(input.revision),
    input.seasonId,
    input.challengeDayKey,
    input.nonce,
  ].join("|");
  const digest = await sha256Hex(material);
  return `pvp:${input.operationId}:${digest}`;
}

function canonicalResponse(input: {
  operationId: string;
  revision: number;
  seasonId: string;
  defender: PublishedPvpTeamSnapshot;
  matchId: string;
  ratingBefore: number;
  ratingAfter: number;
  result: unknown;
  createdAt: string;
}) {
  const result = publicResultSchema.parse(input.result);
  return responseSchema.parse({
    operationId: input.operationId,
    revision: input.revision,
    seasonId: input.seasonId,
    matchId: input.matchId,
    opponent: {
      snapshotId: input.defender.id,
      schoolName: input.defender.school.name,
      schoolShortName: input.defender.school.shortName,
    },
    rating: {
      before: input.ratingBefore,
      after: input.ratingAfter,
      delta: input.ratingAfter - input.ratingBefore,
    },
    result,
    createdAt: input.createdAt,
  });
}

export function createPvpChallengeHandler(
  deps: PvpChallengeHandlerDependencies,
): AuthenticatedRequestHandler {
  const now = deps.now ?? (() => new Date());
  const createMatchNonce = deps.createMatchNonce ?? (() => crypto.randomUUID());

  return async (request, user) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidRequest();
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return invalidRequest();

    const existing = await deps.pvpStore.findChallengeOperation(
      user.id,
      parsed.data.operationId,
    );
    if (existing) {
      if (existing.kind !== "challenge") return operationConflict();
      const replay = responseSchema.safeParse(existing.response);
      if (!replay.success) {
        throw new Error("stored PvP challenge response is invalid");
      }
      return json(replay.data);
    }

    const challenger = await deps.gameStore.getSnapshot(user.id);
    if (!challenger) {
      return jsonError(
        409,
        "game_not_initialized",
        "学校データを作成してください",
      );
    }
    if (challenger.revision !== parsed.data.revision) {
      return revisionConflict();
    }
    const challengerSchool =
      challenger.state.schools[challenger.state.userSchoolId];
    if (!challengerSchool) {
      throw new Error("challenger school is missing from authoritative state");
    }

    const defender = await deps.pvpStore.getSnapshotById(
      parsed.data.opponentSnapshotId,
    );
    if (!defender) {
      return jsonError(
        404,
        "pvp_opponent_unavailable",
        "対戦相手が見つかりません",
      );
    }
    if (!defender.isActive) {
      return jsonError(
        409,
        "pvp_opponent_inactive",
        "この公開チームは更新済みです。対戦相手一覧を更新してください",
      );
    }
    if (defender.userId === user.id) {
      return jsonError(400, "pvp_self_match", "自分のチームとは対戦できません");
    }

    const currentTime = now();
    const seasonId = pvpSeasonId(currentTime);
    const challengeDayKey = pvpJstDayKey(currentTime);
    const matchSeed = await createMatchSeed({
      challengerUserId: user.id,
      defenderSnapshotId: defender.id,
      operationId: parsed.data.operationId,
      revision: challenger.revision,
      seasonId,
      challengeDayKey,
      nonce: createMatchNonce(),
    });
    const simulation = simulatePvpMatch({
      challenger,
      defender,
      matchSeed,
    });

    try {
      const committed = await deps.pvpStore.commitRatedMatch({
        seasonId,
        challengeDayKey,
        operationId: parsed.data.operationId,
        challengerUserId: user.id,
        defenderUserId: defender.userId,
        defenderSnapshotId: defender.id,
        challengerSourceRevision: challenger.revision,
        matchSeed,
        challengerWon: simulation.challengerWon,
        result: {
          ...simulation.result,
          challengerSchoolName: challengerSchool.name,
        },
      });

      let canonicalDefender = defender;
      if (committed.defenderSnapshotId !== defender.id) {
        const racedDefender = await deps.pvpStore.getSnapshotById(
          committed.defenderSnapshotId,
        );
        if (!racedDefender) {
          throw new Error("canonical PvP defender snapshot is missing");
        }
        canonicalDefender = racedDefender;
      }

      return json(
        canonicalResponse({
          operationId: committed.operationId,
          revision: challenger.revision,
          seasonId: committed.seasonId,
          defender: canonicalDefender,
          matchId: committed.matchId,
          ratingBefore: committed.challengerRatingBefore,
          ratingAfter: committed.challengerRatingAfter,
          result: committed.result,
          createdAt: committed.createdAt,
        }),
      );
    } catch (error) {
      if (containsErrorCode(error, "pvp_daily_opponent_limit")) {
        return jsonError(
          409,
          "pvp_daily_opponent_limit",
          "同じ相手とのレーティング対戦は1日3回までです",
        );
      }
      if (containsErrorCode(error, "pvp_operation_conflict")) {
        return operationConflict();
      }
      if (containsErrorCode(error, "pvp_opponent_inactive")) {
        return jsonError(
          409,
          "pvp_opponent_inactive",
          "この公開チームは更新済みです。対戦相手一覧を更新してください",
        );
      }
      if (containsErrorCode(error, "pvp_self_match")) {
        return jsonError(
          400,
          "pvp_self_match",
          "自分のチームとは対戦できません",
        );
      }
      throw error;
    }
  };
}
