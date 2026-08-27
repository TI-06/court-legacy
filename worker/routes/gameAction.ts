import type { AuthenticatedRequestHandler } from "../router";
import type {
  GameStore,
  PersistedOperationResponse,
} from "../data/GameStore";
import { RevisionConflictError } from "../data/GameStore";
import {
  gameActionRequestSchema,
  type GameActionRequest,
} from "../game/actionSchema";
import {
  applyGameAction,
  GameRuleConflictError,
} from "../game/applyGameAction";
import { json, jsonError } from "../http/json";

function invalidAction(): Response {
  return jsonError(400, "invalid_action", "操作内容を確認してください");
}

function revisionConflict(): Response {
  return jsonError(
    409,
    "revision_conflict",
    "別の端末または操作でデータが更新されています",
  );
}

function gameRuleConflict(): Response {
  return jsonError(
    409,
    "game_rule_conflict",
    "現在の状態ではこの操作を実行できません",
  );
}

export function createGameActionHandler(
  store: GameStore,
): AuthenticatedRequestHandler {
  return async (request, user) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidAction();
    }

    const parsed = gameActionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return invalidAction();
    }
    const actionRequest = parsed.data as unknown as GameActionRequest;

    const cached = await store.getOperationResponse(
      user.id,
      actionRequest.operationId,
    );
    if (cached) {
      return json(cached);
    }

    const snapshot = await store.getSnapshot(user.id);
    if (!snapshot) {
      return jsonError(
        409,
        "game_not_initialized",
        "学校データを作成してください",
      );
    }
    if (snapshot.revision !== actionRequest.revision) {
      return revisionConflict();
    }

    let applied;
    try {
      applied = applyGameAction(snapshot, actionRequest.action);
    } catch (error) {
      if (error instanceof GameRuleConflictError) {
        return gameRuleConflict();
      }
      throw error;
    }

    const response: PersistedOperationResponse = {
      game: {
        ...snapshot,
        revision: snapshot.revision + 1,
        state: applied.state,
        teamSelection: applied.teamSelection,
      },
      operationId: actionRequest.operationId,
    };
    if (applied.outcome !== undefined) {
      response.outcome = applied.outcome;
    }

    try {
      const persisted = await store.applyOperation({
        userId: user.id,
        operationId: actionRequest.operationId,
        expectedRevision: snapshot.revision,
        state: applied.state,
        teamSelection: applied.teamSelection,
        response,
      });
      return json(persisted.response);
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        return revisionConflict();
      }
      throw error;
    }
  };
}
