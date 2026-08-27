import { z } from "zod";
import type { GameStore } from "../data/GameStore";
import type { ScoutingStore } from "../data/ScoutingStore";
import { json, jsonError } from "../http/json";
import type { AuthenticatedRequestHandler } from "../router";
import {
  buildServerScoutReports,
  generateServerScoutingCandidates,
  scoutingCycleKey,
} from "../scouting/serverScoutingBoard";

const requestSchema = z
  .object({
    operationId: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(1).max(120)),
    revision: z.number().int().positive(),
  })
  .strict();

export interface ScoutingBoardHandlerDependencies {
  gameStore: GameStore;
  scoutingStore: ScoutingStore;
}

function invalidRequest(): Response {
  return jsonError(400, "invalid_scouting_request", "スカウト条件を確認してください");
}

function revisionConflict(): Response {
  return jsonError(
    409,
    "revision_conflict",
    "別の端末または操作でデータが更新されています",
  );
}

export function createScoutingBoardHandler(
  deps: ScoutingBoardHandlerDependencies,
): AuthenticatedRequestHandler {
  return async (request, user) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidRequest();
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return invalidRequest();
    }

    const snapshot = await deps.gameStore.getSnapshot(user.id);
    if (!snapshot) {
      return jsonError(
        409,
        "game_not_initialized",
        "学校データを作成してください",
      );
    }
    if (snapshot.revision !== parsed.data.revision) {
      return revisionConflict();
    }

    const cycleKey = scoutingCycleKey(snapshot.state);
    let pool = await deps.scoutingStore.getCandidatePool(user.id, cycleKey);

    if (!pool) {
      pool = await deps.scoutingStore.createCandidatePool({
        userId: user.id,
        cycleKey,
        creationOperationId: parsed.data.operationId,
        candidates: generateServerScoutingCandidates(snapshot.state),
      });
    }

    return json({
      operationId: parsed.data.operationId,
      revision: snapshot.revision,
      cycleKey,
      reports: buildServerScoutReports(snapshot.state, pool),
    });
  };
}
