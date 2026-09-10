import { z } from "zod";
import type { PvpMatchSessionStore } from "../data/PvPStore";
import { json, jsonError } from "../http/json";
import type { AuthenticatedRequestHandler } from "../router";

const operationIdSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(120));

export interface PvpChallengeSessionHandlerDependencies {
  pvpStore: PvpMatchSessionStore;
}

export function createPvpChallengeSessionHandler(
  deps: PvpChallengeSessionHandlerDependencies,
): AuthenticatedRequestHandler {
  return async (request, user) => {
    const operationId = operationIdSchema.safeParse(
      new URL(request.url).searchParams.get("operationId"),
    );
    if (!operationId.success) {
      return jsonError(
        400,
        "invalid_pvp_session_request",
        "対戦セッションを確認してください",
      );
    }

    const session = await deps.pvpStore.getMatchSession(
      user.id,
      operationId.data,
    );
    if (!session) {
      return jsonError(
        404,
        "pvp_match_session_not_found",
        "対戦セッションが見つかりません",
      );
    }

    return json(session.finalResponse ?? session.publicResponse);
  };
}
