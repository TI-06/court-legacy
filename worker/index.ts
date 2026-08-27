import { createVerifyAccessToken } from "./auth/verifyAccessToken";
import type { GameStore } from "./data/GameStore";
import type { ScoutingStore } from "./data/ScoutingStore";
import { SupabaseGameStore } from "./data/SupabaseGameStore";
import { SupabaseScoutingStore } from "./data/SupabaseScoutingStore";
import { createSupabaseAdmin } from "./data/createSupabaseAdmin";
import type { Env } from "./env";
import { createRouter } from "./router";

function createLazyGameStore(env: Env): GameStore {
  let resolved: SupabaseGameStore | null = null;
  const store = () => {
    resolved ??= new SupabaseGameStore(createSupabaseAdmin(env));
    return resolved;
  };

  return {
    getSnapshot: (userId) => store().getSnapshot(userId),
    getOperationResponse: (userId, operationId) =>
      store().getOperationResponse(userId, operationId),
    createGame: (input) => store().createGame(input),
    applyOperation: (input) => store().applyOperation(input),
  };
}

function createLazyScoutingStore(env: Env): ScoutingStore {
  let resolved: SupabaseScoutingStore | null = null;
  const store = () => {
    resolved ??= new SupabaseScoutingStore(createSupabaseAdmin(env));
    return resolved;
  };

  return {
    getCandidatePool: (userId, cycleKey) =>
      store().getCandidatePool(userId, cycleKey),
    createCandidatePool: (input) => store().createCandidatePool(input),
  };
}

export default {
  fetch(request, env) {
    const router = createRouter({
      verifyAccessToken: (token) => createVerifyAccessToken(env)(token),
      store: createLazyGameStore(env),
      scoutingStore: createLazyScoutingStore(env),
    });
    return router(request);
  },
} satisfies ExportedHandler<Env>;
