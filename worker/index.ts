import { createVerifyAccessToken } from "./auth/verifyAccessToken";
import type { GameStore } from "./data/GameStore";
import type { PvPStore } from "./data/PvPStore";
import type { ScoutingStore } from "./data/ScoutingStore";
import { SupabaseGameStore } from "./data/SupabaseGameStore";
import { SupabasePvPStore } from "./data/SupabasePvPStore";
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
    listCandidateInsights: (userId, cycleKey) =>
      store().listCandidateInsights(userId, cycleKey),
  };
}

function createLazyPvpStore(env: Env): PvPStore {
  let resolved: SupabasePvPStore | null = null;
  const store = () => {
    resolved ??= new SupabasePvPStore(createSupabaseAdmin(env));
    return resolved;
  };

  return {
    publishSnapshot: (input) => store().publishSnapshot(input),
    findChallengeOperation: (userId, operationId) =>
      store().findChallengeOperation(userId, operationId),
    getSnapshotById: (snapshotId) => store().getSnapshotById(snapshotId),
    commitRatedMatch: (input) => store().commitRatedMatch(input),
    listOpponents: (input) => store().listOpponents(input),
    listRanking: (input) => store().listRanking(input),
    listHistory: (input) => store().listHistory(input),
  };
}

export default {
  fetch(request, env) {
    const router = createRouter({
      verifyAccessToken: (token) => createVerifyAccessToken(env)(token),
      store: createLazyGameStore(env),
      scoutingStore: createLazyScoutingStore(env),
      pvpStore: createLazyPvpStore(env),
    });
    return router(request);
  },
} satisfies ExportedHandler<Env>;
