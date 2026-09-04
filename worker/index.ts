import { SupabaseAccountAuthService } from "./auth/AccountAuthService";
import { createVerifyAccessToken } from "./auth/verifyAccessToken";
import type { GameStore } from "./data/GameStore";
import type { PvPStore } from "./data/PvPStore";
import type { ScoutingStore } from "./data/ScoutingStore";
import type { ShopStore } from "./data/ShopStore";
import { SupabaseGameStore } from "./data/SupabaseGameStore";
import { SupabasePvPStore } from "./data/SupabasePvPStore";
import { SupabaseScoutingStore } from "./data/SupabaseScoutingStore";
import { SupabaseShopStore } from "./data/SupabaseShopStore";
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

function createLazyShopStore(env: Env): ShopStore {
  let resolved: SupabaseShopStore | null = null;
  const store = () => {
    resolved ??= new SupabaseShopStore(createSupabaseAdmin(env));
    return resolved;
  };

  return {
    findOperation: (userId, operationId) =>
      store().findOperation(userId, operationId),
    getStatus: (userId, currentYearIndex) =>
      store().getStatus(userId, currentYearIndex),
    purchase: (input) => store().purchase(input),
    use: (input) => store().use(input),
  };
}

export default {
  fetch(request, env) {
    const admin = createSupabaseAdmin(env);
    const router = createRouter({
      verifyAccessToken: (token) => createVerifyAccessToken(env)(token),
      accountAuth: new SupabaseAccountAuthService({
        admin,
        url: env.SUPABASE_URL,
        secretKey: env.SUPABASE_SECRET_KEY,
      }),
      store: createLazyGameStore(env),
      scoutingStore: createLazyScoutingStore(env),
      pvpStore: createLazyPvpStore(env),
      shopStore: createLazyShopStore(env),
    });
    return router(request);
  },
} satisfies ExportedHandler<Env>;
