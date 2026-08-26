import type {
  AuthenticatedUser,
  VerifyAccessToken,
} from "./auth/verifyAccessToken";
import { json, jsonError } from "./http/json";

export type AuthenticatedRequestHandler = (
  request: Request,
  user: AuthenticatedUser,
) => Promise<Response>;

export interface WorkerDependencies {
  verifyAccessToken: VerifyAccessToken;
  handleAuthenticatedRequest?: AuthenticatedRequestHandler;
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

    if (!deps.handleAuthenticatedRequest) {
      return notFound();
    }

    return deps.handleAuthenticatedRequest(request, user);
  };
}
