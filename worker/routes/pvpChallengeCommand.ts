import { z } from "zod";
import type { MatchCommand } from "../../src/domain/model/Match";
import { playerId } from "../../src/domain/model/identifiers";
import { MatchCommandValidationError } from "../../src/domain/match/applyMatchCommand";
import type {
  PersistedPvpMatchSession,
  PvpMatchSessionStore,
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
      return json(receipt.publicResponse);
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

    if (resumed.segment.status === "complete") {
      throw new Error("PvP completed-session finalization is not wired yet");
    }

    const publicResponse = inProgressResponse(resumed.session, resumed.segment);
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
  };
}
