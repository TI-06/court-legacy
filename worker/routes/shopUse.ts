import {
  shopUseRequestSchema,
  type ShopUseRequest,
} from "../../src/domain/shop/shopContracts";
import type { GameStore } from "../data/GameStore";
import type { ScoutingStore } from "../data/ScoutingStore";
import {
  ShopStoreMutationError,
  type ShopMutationErrorCode,
  type ShopStore,
} from "../data/ShopStore";
import { json, jsonError } from "../http/json";
import type { AuthenticatedRequestHandler } from "../router";
import {
  resolveShopUse,
  ShopUseResolutionError,
  type ResolveShopUseInput,
  type ResolvedShopUse,
} from "../shop/resolveShopUse";

export interface ShopUseHandlerDependencies {
  gameStore: GameStore;
  shopStore: ShopStore;
  scoutingStore?: ScoutingStore;
  resolveUse?: (input: ResolveShopUseInput) => Promise<ResolvedShopUse>;
}

function invalidUse(): Response {
  return jsonError(400, "invalid_shop_use", "使用内容を確認してください");
}

function conflictMessage(code: ShopMutationErrorCode | ShopUseResolutionError["code"]): string {
  switch (code) {
    case "revision_conflict":
      return "別の端末または操作でデータが更新されています";
    case "operation_id_reused":
      return "同じ操作IDが別の操作内容で使用されています";
    case "inventory_empty":
      return "このアイテムを所持していません";
    case "inventory_expired":
      return "前年度のアイテムは使用できません";
    case "use_limit_reached":
      return "この年度の使用上限に達しています";
    case "item_not_found":
      return "アイテムを確認できません";
    case "item_disabled":
      return "このアイテムは現在使用できません";
    case "invalid_target":
      return "このアイテムの使用対象を確認してください";
    case "target_not_found":
      return "使用対象を確認できません";
    case "effect_already_pending":
      return "同じ効果がすでに有効です";
    case "scouting_cycle_unavailable":
      return "現在のスカウト候補には使用できません";
    default:
      return "現在の状態では使用できません";
  }
}

function requestFingerprint(request: ShopUseRequest): string {
  return JSON.stringify({
    operationType: "use",
    revision: request.revision,
    itemId: request.itemId,
    target: request.target ?? null,
  });
}

export function createShopUseHandler(
  deps: ShopUseHandlerDependencies,
): AuthenticatedRequestHandler {
  const resolveUse = deps.resolveUse ?? resolveShopUse;

  return async (request, user) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidUse();
    }

    const parsed = shopUseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return invalidUse();
    }

    const fingerprint = requestFingerprint(parsed.data);
    const existing = await deps.shopStore.findOperation(
      user.id,
      parsed.data.operationId,
    );
    if (existing) {
      if (
        existing.operationType === "use" &&
        existing.requestFingerprint === fingerprint
      ) {
        return json(existing.response);
      }
      return jsonError(
        409,
        "operation_id_reused",
        conflictMessage("operation_id_reused"),
      );
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
      return jsonError(
        409,
        "revision_conflict",
        conflictMessage("revision_conflict"),
      );
    }

    let resolved: ResolvedShopUse;
    try {
      resolved = await resolveUse({
        snapshot,
        request: parsed.data,
        scoutingStore: deps.scoutingStore,
      });
    } catch (error) {
      if (error instanceof ShopUseResolutionError) {
        return jsonError(409, error.code, conflictMessage(error.code));
      }
      throw error;
    }

    try {
      const result = await deps.shopStore.use({
        userId: user.id,
        operationId: parsed.data.operationId,
        requestFingerprint: fingerprint,
        expectedRevision: parsed.data.revision,
        itemId: parsed.data.itemId,
        state: resolved.state,
        teamSelection: resolved.teamSelection,
        targetType: resolved.targetType,
        targetId: resolved.targetId,
        safeRequest: resolved.safeRequest,
        publicResult: resolved.publicResult,
        scoutingCycleKey: resolved.scoutingCycleKey ?? null,
        scoutingCandidates: resolved.scoutingCandidates ?? null,
        scoutingInsight: resolved.scoutingInsight
          ? { ...resolved.scoutingInsight }
          : null,
      });
      return json(result.response);
    } catch (error) {
      if (error instanceof ShopStoreMutationError) {
        if (error.code === "server_error") {
          throw error;
        }
        return jsonError(409, error.code, conflictMessage(error.code));
      }
      throw error;
    }
  };
}
