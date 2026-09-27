import type { GameStore } from "../data/GameStore";
import { json, jsonError } from "../http/json";
import type { AuthenticatedRequestHandler } from "../router";

export function createGameResetHandler(
  store: GameStore,
): AuthenticatedRequestHandler {
  return async (_request, user) => {
    if (!store.resetGameData) {
      return jsonError(
        501,
        "reset_unavailable",
        "ゲームデータの初期化を利用できません",
      );
    }

    await store.resetGameData(user.id);
    return json({ status: "reset" });
  };
}
