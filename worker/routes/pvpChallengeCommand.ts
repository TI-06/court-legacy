import { z } from "zod";
import type { MatchCommand } from "../../src/domain/model/Match";
import { playerId } from "../../src/domain/model/identifiers";
import { MatchCommandValidationError } from "../../src/domain/match/applyMatchCommand";
import type {
  PersistedPvpMatchSession,
  PvpMatchSessionStore,
  PublishedPvpTeamSnapshot,
} from "../data/PvPStore";
import { matchTacticPlanSchema } from "../game/actionSchema";
import { json, jsonError } from "../http/json";
import {
  resumePvpMatchSession,
  type PvpMatchSegment,
  type PvpServerMatchSession,
} from "../pvp/pvpMatchSession";
import type { AuthenticatedRequestHandler } from "../router";

const playerIdSchema = z.string().min(1).transform(playerId);

const matchCommandSchema: z.ZodType<MatchCommand> = z.discriminatedUnion(
  "type",
  [
    z.object({ type: z.literal("timeout") }).strict(),
    z
      .object({
        type: z.literal("set-match-tactics"),
        plan: matchTacticPlanSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("substitute"),
        outgoingPlayerId: playerIdSchema,
        incomingPlayerId: playerIdSchema,
      })
      .strict(),
    z.object({ type: z.literal("continue") }).strict(),
  ],
);

const requestSchema = z
  .object({
    operationId: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(1).max(120)),
    commandId: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(1).max(120)),
    command: matchCommandSchema,
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

const privateSessionEnvelopeSchema = z
  .object({
    operationId: z.string().min(1),
    challengerUserId: z.string().min(1),
    defenderUserId: z.string().min(1),
    defenderSnapshotId: z.string().min(1),
    challengerSourceRevision: z.number().int().positive(),
    seasonId: z.string().min(1),
    challengeDayKey: z.string().min(1),
    matchSeed: z.string().min(1),
    simulationState: z
      .object({
        schools: z.record(z.string(), z.unknown()),
      })
      .passthrough(),
    challengerSchoolId: z.string().min(1),
    defenderSchoolId: z.string().min(1),
    match: z
      .object({
        randomCursor: z.number().int().nonnegative(),
        phase: z.enum([
          "pre-match",
          "set-in-progress",
          "coach-decision",
          "set-complete",
          "match-complete",
        ]),
      })
      .passthrough(),
    finalized: z.boolean(),
  })
  .passthrough();

export interface PvpChallengeCommandHandlerDependencies {
  pvpStore: PvpMatchSessionStore;
}

function sameCommand(left: MatchCommand, right: MatchCommand): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
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

function parsePrivateSession(
  persisted: PersistedPvpMatchSession,
  userId: string,
  operationId: string,
): PvpServerMatchSession {
  const parsed = privateSessionEnvelopeSchema.safeParse(
    persisted.privateSession,
  );
  if (!parsed.success) {
    throw new Error("stored PvP private session is invalid");
  }
  const session = parsed.data;
  if (
    session.challengerUserId !== userId ||
    session.operationId !== operationId ||
    session.defenderSnapshotId !== persisted.defenderSnapshotId ||
    session.challengerSourceRevision !== persisted.challengerSourceRevision ||
    session.match.randomCursor !== persisted.currentCursor
  ) {
    throw new Error(
      "stored PvP private session does not match persistence metadata",
    );
  }
  return session as unknown as PvpServerMatchSession;
}

function inProgressResponse(
  session: PvpServerMatchSession,
  segment: PvpMatchSegment,
) {
  const defenderSchool =
    session.simulationState.schools[session.defenderSchoolId];
  if (!defenderSchool) {
    throw new Error("stored PvP defender school is missing");
  }
  return {
    status: "in-progress" as const,
    operationId: session.operationId,
    revision: session.challengerSourceRevision,
    seasonId: session.seasonId,
    opponent: {
      snapshotId: session.defenderSnapshotId,
      schoolName: defenderSchool.name,
      schoolShortName: defenderSchool.shortName,
    },
    segment,
  };
}

function completedResult(session: PvpServerMatchSession) {
  const challengerWon = session.match.homeSetsWon > session.match.awaySetsWon;
  return {
    challengerWon,
    publicResult: {
      outcome: challengerWon ? ("win" as const) : ("loss" as const),
      challengerSetsWon: session.match.homeSetsWon,
      defenderSetsWon: session.match.awaySetsWon,
      sets: session.match.sets.map((set) => ({
        setNumber: set.setNumber,
        challengerScore: set.homeScore,
        defenderScore: set.awayScore,
      })),
    },
  };
}

function canonicalCompletedResponse(input: {
  session: PvpServerMatchSession;
  defender: PublishedPvpTeamSnapshot;
  matchId: string;
  ratingBefore: number;
  ratingAfter: number;
  result: unknown;
  createdAt: string;
}) {
  return completedResponseSchema.parse({
    operationId: input.session.operationId,
    revision: input.session.challengerSourceRevision,
    seasonId: input.session.seasonId,
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
    result: input.result,
    createdAt: input.createdAt,
  });
}

async function recoverCompletedReceipt(
  deps: PvpChallengeCommandHandlerDependencies,
  userId: string,
  operationId: string,
  publicResponse: unknown,
): Promise<unknown> {
  const completed = completedResponseSchema.safeParse(publicResponse);
  if (!completed.success) return publicResponse;
  const stored = await deps.pvpStore.storeMatchSessionFinalResponse({
    challengerUserId: userId,
    operationId,
    finalResponse: completed.data,
  });
  return stored.finalResponse ?? completed.data;
}

export function createPvpChallengeCommandHandler(
  deps: PvpChallengeCommandHandlerDependencies,
): AuthenticatedRequestHandler {
  return async (request, user) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(
        400,
        "invalid_pvp_command_request",
        "監督指示を確認してください",
      );
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        400,
        "invalid_pvp_command_request",
        "監督指示を確認してください",
      );
    }

    const receipt = await deps.pvpStore.getMatchSessionCommandReceipt(
      user.id,
      parsed.data.operationId,
      parsed.data.commandId,
    );
    if (receipt) {
      const receiptCommand = matchCommandSchema.safeParse(receipt.command);
      if (!receiptCommand.success) {
        throw new Error("stored PvP command receipt is invalid");
      }
      if (!sameCommand(receiptCommand.data, parsed.data.command)) {
        return jsonError(
          409,
          "pvp_command_conflict",
          "同じ操作IDで別の監督指示が送信されています",
        );
      }
      return json(
        await recoverCompletedReceipt(
          deps,
          user.id,
          parsed.data.operationId,
          receipt.publicResponse,
        ),
      );
    }

    const persisted = await deps.pvpStore.getMatchSession(
      user.id,
      parsed.data.operationId,
    );
    if (!persisted) {
      return jsonError(
        404,
        "pvp_match_session_not_found",
        "対戦セッションが見つかりません",
      );
    }
    if (persisted.finalResponse) {
      return json(persisted.finalResponse);
    }

    const privateSession = parsePrivateSession(
      persisted,
      user.id,
      parsed.data.operationId,
    );
    let resumed;
    try {
      resumed = resumePvpMatchSession({
        session: privateSession,
        command: parsed.data.command,
      });
    } catch (error) {
      if (error instanceof MatchCommandValidationError) {
        return jsonError(409, "pvp_command_not_available", error.message);
      }
      throw error;
    }

    if (resumed.segment.status !== "complete") {
      const publicResponse = inProgressResponse(
        resumed.session,
        resumed.segment,
      );
      const saved = await deps.pvpStore.saveMatchSessionCommand({
        challengerUserId: user.id,
        operationId: parsed.data.operationId,
        commandId: parsed.data.commandId,
        command: parsed.data.command,
        expectedCursor: persisted.currentCursor,
        nextCursor: resumed.session.match.randomCursor,
        privateSession: resumed.session,
        publicResponse,
      });

      return json(
        saved.replayed ? saved.commandResponse : saved.session.publicResponse,
      );
    }

    const challengerSchool =
      resumed.session.simulationState.schools[resumed.session.challengerSchoolId];
    if (!challengerSchool) {
      throw new Error("stored PvP challenger school is missing");
    }
    const result = completedResult(resumed.session);

    try {
      const committed = await deps.pvpStore.commitRatedMatch({
        seasonId: resumed.session.seasonId,
        challengeDayKey: resumed.session.challengeDayKey,
        operationId: resumed.session.operationId,
        challengerUserId: resumed.session.challengerUserId,
        defenderUserId: resumed.session.defenderUserId,
        defenderSnapshotId: resumed.session.defenderSnapshotId,
        challengerSourceRevision: resumed.session.challengerSourceRevision,
        matchSeed: resumed.session.matchSeed,
        challengerWon: result.challengerWon,
        result: {
          ...result.publicResult,
          challengerSchoolName: challengerSchool.name,
        },
      });

      const canonicalDefender = await deps.pvpStore.getSnapshotById(
        committed.defenderSnapshotId,
      );
      if (!canonicalDefender) {
        throw new Error("canonical PvP defender snapshot is missing");
      }
      const finalResponse = canonicalCompletedResponse({
        session: resumed.session,
        defender: canonicalDefender,
        matchId: committed.matchId,
        ratingBefore: committed.challengerRatingBefore,
        ratingAfter: committed.challengerRatingAfter,
        result: committed.result,
        createdAt: committed.createdAt,
      });
      const finalizedSession: PvpServerMatchSession = {
        ...resumed.session,
        finalized: true,
      };
      const saved = await deps.pvpStore.saveMatchSessionCommand({
        challengerUserId: user.id,
        operationId: parsed.data.operationId,
        commandId: parsed.data.commandId,
        command: parsed.data.command,
        expectedCursor: persisted.currentCursor,
        nextCursor: finalizedSession.match.randomCursor,
        privateSession: finalizedSession,
        publicResponse: finalResponse,
      });
      const canonicalResponse = saved.replayed
        ? saved.commandResponse
        : saved.session.publicResponse;
      const stored = await deps.pvpStore.storeMatchSessionFinalResponse({
        challengerUserId: user.id,
        operationId: parsed.data.operationId,
        finalResponse: canonicalResponse,
      });
      return json(stored.finalResponse ?? canonicalResponse);
    } catch (error) {
      if (containsErrorCode(error, "pvp_daily_opponent_limit")) {
        return jsonError(
          409,
          "pvp_daily_opponent_limit",
          "同じ相手とのレーティング対戦は1日3回までです",
        );
      }
      if (containsErrorCode(error, "pvp_operation_conflict")) {
        return jsonError(
          409,
          "pvp_operation_conflict",
          "同じ操作IDが別の対人戦操作で使用されています",
        );
      }
      if (containsErrorCode(error, "pvp_opponent_inactive")) {
        return jsonError(
          409,
          "pvp_opponent_inactive",
          "この公開チームは更新済みです。対戦相手一覧を更新してください",
        );
      }
      if (containsErrorCode(error, "pvp_match_session_stale")) {
        return jsonError(
          409,
          "pvp_match_session_stale",
          "別の監督指示が先に反映されています。対戦画面を更新してください",
        );
      }
      throw error;
    }
  };
}
