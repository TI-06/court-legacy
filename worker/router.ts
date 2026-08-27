import type {
  AuthenticatedUser,
  VerifyAccessToken,
} from "./auth/verifyAccessToken";
import type { GameStore } from "./data/GameStore";
import type { ScoutingStore } from "./data/ScoutingStore";
import { json, jsonError } from "./http/json";
import { createBootstrapHandler } from "./routes/bootstrap";
import { createGameActionHandler } from "./routes/gameAction";
import { createOnboardingHandler } from "./routes/onboarding";
import { createScoutingBoardHandler } from "./routes/scoutingBoard";
import { createScoutingRecruitmentHandler } from "./routes/scoutingRecruitment";

export type AuthenticatedRequestHandler = (
  request: Request,
  user: AuthenticatedUser,
) => Promise<Response>;

export interface WorkerDependencies {
  verifyAccessToken: VerifyAccessToken;
  store: GameStore;
  scoutingStore?: ScoutingStore;
  createCreationNonce?: () => string;
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

function notFound(): Response {
  return jsonError(404, "not_found", "API route not found");
}

export function createRouter(
  deps: WorkerDependencies,
): (request: Request) => Promise<Response> {
  const bootstrap = createBootstrapHandler(deps.store);
  const onboarding = createOnboardingHandler({
    store: deps.store,
    createCreationNonce: deps.createCreationNonce,
  });
  const gameAction = createGameActionHandler(deps.store, deps.scoutingStore);
  const scoutingBoard = deps.scoutingStore
    ? createScoutingBoardHandler({
        gameStore: deps.store,
        scoutingStore: deps.scoutingStore,
      })
    : null;
  const scoutingRecruitment = deps.scoutingStore
    ? createScoutingRecruitmentHandler({
        gameStore: deps.store,
        scoutingStore: deps.scoutingStore,
      })
    : null;

  return async (request) => {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return notFound();
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/api/health") {
      return json({ status: "ok" });
    }

    const token = bearerToken(request);
    if (!token) {
      return jsonError(401, "unauthenticated", "Authentication is required");
    }

    let user: AuthenticatedUser;
    try {
      user = await deps.verifyAccessToken(token);
    } catch {
      return jsonError(401, "unauthenticated", "Authentication is required");
    }

    try {
      if (url.pathname === "/api/bootstrap" && request.method === "GET") {
        return await bootstrap(request, user);
      }
      if (url.pathname === "/api/onboarding" && request.method === "POST") {
        return await onboarding(request, user);
      }
      if (url.pathname === "/api/game/action" && request.method === "POST") {
        return await gameAction(request, user);
      }
      if (
        url.pathname === "/api/scouting/board" &&
        request.method === "POST" &&
        scoutingBoard
      ) {
        return await scoutingBoard(request, user);
      }
      if (
        url.pathname === "/api/scouting/recruit" &&
        request.method === "POST" &&
        scoutingRecruitment
      ) {
        return await scoutingRecruitment(request, user);
      }
      return notFound();
    } catch {
      return jsonError(500, "server_error", "サーバー処理に失敗しました");
    }
  };
}
