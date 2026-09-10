import { z } from "zod";
import type { MatchCommand } from "../../src/domain/model/Match";
import type { PvpMatchSessionStore } from "../data/PvPStore";
import { matchTacticPlanSchema } from "../game/actionSchema";
import { json, jsonError } from "../http/json";
import type { AuthenticatedRequestHandler } from "../router";

const playerIdSchema = z.string().min(1);

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

export interface PvpChallengeCommandHandlerDependencies {
  pvpStore: PvpMatchSessionStore;
}

function sameCommand(left: MatchCommand, right: MatchCommand): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
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

    const session = await deps.pvpStore.getMatchSession(
      user.id,
      parsed.data.operationId,
    );
    if (!session) {
      return jsonError(
        404,
        "pvp_match_session_not_found",
        "対戦セッションが見つかりません",
      );
    }
    if (session.finalResponse) {
      return json(session.finalResponse);
    }

    return jsonError(
      409,
      "pvp_command_not_available",
      "現在は監督指示を送信できません",
    );
  };
}
