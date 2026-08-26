import type { AuthenticatedRequestHandler } from "../router";
import type { CloudGameSnapshot, GameStore } from "../data/GameStore";
import { json } from "../http/json";

export type BootstrapResponse =
  | { status: "needs-onboarding" }
  | { status: "ready"; game: CloudGameSnapshot };

export function createBootstrapHandler(
  store: GameStore,
): AuthenticatedRequestHandler {
  return async (_request, user) => {
    const snapshot = await store.getSnapshot(user.id);
    const response: BootstrapResponse = snapshot
      ? { status: "ready", game: snapshot }
      : { status: "needs-onboarding" };
    return json(response);
  };
}
