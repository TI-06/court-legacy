import { z } from "zod";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import { pvpJstDayKey, pvpSeasonId } from "../../src/domain/pvp/season";
import type { GameStore } from "../data/GameStore";
import type { PvpMatchSessionStore } from "../data/PvPStore";
import {
  matchTacticPlanSchema,
  teamSelectionSchema,
} from "../game/actionSchema";
import {
  applyGameAction,
  GameRuleConflictError,
} from "../game/applyGameAction";
import { json, jsonError } from "../http/json";
import { startPvpMatchSession } from "../pvp/pvpMatchSession";
import type { AuthenticatedRequestHandler } from "../router";

const requestSchema = z
  .object({
    operationId: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(1).max(120)),
    revision: z.number().int().positive(),
    opponentSnapshotId: z.string().uuid(),
    matchSelection: teamSelectionSchema.optional(),
    matchTactics: matchTacticPlanSchema.optional(),
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

const completedResponseSchema = z
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
  pvpStore: PvpMatchSessionStore;
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
      const replay = completedResponseSchema.safeParse(existing.response);
      if (!replay.success) {
        throw new Error("stored PvP challenge response is invalid");
      }
      return json(replay.data);
    }

    const existingSession = await deps.pvpStore.getMatchSession(
      user.id,
      parsed.data.operationId,
    );
    if (existingSession) {
      if (
        existingSession.defenderSnapshotId !== parsed.data.opponentSnapshotId ||
        existingSession.challengerSourceRevision !== parsed.data.revision
      ) {
        return operationConflict();
      }
      return json(existingSession.finalResponse ?? existingSession.publicResponse);
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

    const matchSelection = parsed.data.matchSelection as
      | TeamSelection
      | undefined;
    let challengerForMatch = challenger;
    if (matchSelection) {
      try {
        const validated = applyGameAction(challenger, {
          type: "team-selection",
          selection: matchSelection,
        });
        challengerForMatch = {
          ...challenger,
          teamSelection: validated.teamSelection,
        };
      } catch (error) {
        if (error instanceof GameRuleConflictError) {
          return jsonError(400, "invalid_team_selection", error.message);
        }
        throw error;
      }
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
    const started = startPvpMatchSession({
      operationId: parsed.data.operationId,
      challenger: challengerForMatch,
      defender,
      challengerSourceRevision: challenger.revision,
      seasonId,
      challengeDayKey,
      matchSeed,
      matchTactics: parsed.data.matchTactics,
    });
    const publicResponse = {
      status: "in-progress" as const,
      operationId: parsed.data.operationId,
      revision: challenger.revision,
      seasonId,
      opponent: {
        snapshotId: defender.id,
        schoolName: defender.school.name,
        schoolShortName: defender.school.shortName,
      },
      segment: started.segment,
    };

    try {
      const persisted = await deps.pvpStore.createMatchSession({
        challengerUserId: user.id,
        operationId: parsed.data.operationId,
        defenderSnapshotId: defender.id,
        challengerSourceRevision: challenger.revision,
        currentCursor: started.session.match.randomCursor,
        privateSession: started.session,
        publicResponse,
      });
      return json(persisted.finalResponse ?? persisted.publicResponse);
    } catch (error) {
      if (
        containsErrorCode(error, "pvp_operation_conflict") ||
        containsErrorCode(error, "pvp_session_operation_conflict")
      ) {
        return operationConflict();
      }
      throw error;
    }
  };
}
