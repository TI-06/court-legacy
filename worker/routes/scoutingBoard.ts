import { z } from "zod";
import type { GameStore, PersistedOperationResponse } from "../data/GameStore";
import { RevisionConflictError } from "../data/GameStore";
import { consumeBaseScoutingSearch } from "../../src/domain/scouting/scoutingSearchBudget";
import type { ScoutingStore } from "../data/ScoutingStore";
import type { ShopStore } from "../data/ShopStore";
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
    search: z
      .object({
        region: z.enum(["prefecture", "regional", "national"]),
        position: z.enum(["any", "OH", "MB", "S", "OP", "L"]),
        priority: z.enum(["ability", "potential", "physical", "immediate", "hidden"]),
      })
      .strict()
      .optional(),
  })
  .strict();

export interface ScoutingBoardHandlerDependencies {
  gameStore: GameStore;
  scoutingStore: ScoutingStore;
  shopStore?: ShopStore;
}

function invalidRequest(): Response {
  return jsonError(
    400,
    "invalid_scouting_request",
    "スカウト条件を確認してください",
  );
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
    let activeState = snapshot.state;
    let activeRevision = snapshot.revision;

    if (parsed.data.search) {
      const searchedState = consumeBaseScoutingSearch(snapshot.state);
      if (!searchedState) {
        const shopItems = deps.shopStore
          ? await deps.shopStore.getStatus(user.id, snapshot.state.yearIndex)
          : [];
        const ticket = shopItems.find((item) => item.itemId === "extra-scout-trip");
        if (!ticket || ticket.quantityOwned <= 0) {
          return jsonError(
            409,
            "scouting_search_limit",
            "通常スカウト3回を使い切りました。追加スカウト権が必要です",
          );
        }
        return jsonError(
          409,
          "extra_scout_ticket_required",
          "追加スカウト権を使用してから探索してください",
        );
      }

      if (!pool) {
        pool = await deps.scoutingStore.createCandidatePool({
          userId: user.id,
          cycleKey,
          creationOperationId: parsed.data.operationId,
          candidates: generateServerScoutingCandidates(
            snapshot.state,
            parsed.data.search,
          ),
        });
      }

      const response: PersistedOperationResponse = {
        game: {
          ...snapshot,
          revision: snapshot.revision + 1,
          state: searchedState,
        },
        operationId: parsed.data.operationId,
        outcome: { cycleKey, scoutingSearchesUsed: searchedState.recruiting?.scoutingSearchesUsed ?? 0 },
      };
      try {
        const persisted = await deps.gameStore.applyOperation({
          userId: user.id,
          operationId: parsed.data.operationId,
          expectedRevision: snapshot.revision,
          state: searchedState,
          teamSelection: snapshot.teamSelection,
          response,
        });
        activeState = persisted.response.game.state;
        activeRevision = persisted.response.game.revision;
      } catch (error) {
        if (error instanceof RevisionConflictError) return revisionConflict();
        throw error;
      }
    } else if (!pool) {
      pool = await deps.scoutingStore.createCandidatePool({
        userId: user.id,
        cycleKey,
        creationOperationId: parsed.data.operationId,
        candidates: generateServerScoutingCandidates(snapshot.state),
      });
    }

    return json({
      operationId: parsed.data.operationId,
      revision: activeRevision,
      cycleKey,
      scoutingSearchesUsed: activeState.recruiting?.scoutingSearchesUsed ?? 0,
      reports: buildServerScoutReports(activeState, pool),
    });
  };
}
