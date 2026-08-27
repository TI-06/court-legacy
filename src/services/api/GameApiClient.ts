import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import type {
  GameActionRequest,
  GameActionResponse,
} from "../../../worker/game/actionSchema";

export type BootstrapResponse =
  { status: "needs-onboarding" } | { status: "ready"; game: CloudGameSnapshot };

export interface ReadyBootstrapResponse {
  status: "ready";
  game: CloudGameSnapshot;
}

export interface OnboardingInput {
  displayName: string;
  schoolName: string;
  schoolShortName: string;
  coachName: string;
  regionId: string;
}

export interface GameApiClient {
  bootstrap(
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<BootstrapResponse>;
  onboard(
    accessToken: string,
    input: OnboardingInput,
    signal?: AbortSignal,
  ): Promise<ReadyBootstrapResponse>;
  applyAction(
    accessToken: string,
    request: GameActionRequest,
    signal?: AbortSignal,
  ): Promise<GameActionResponse>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number | null,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorPayload {
  error?: {
    code?: unknown;
    message?: unknown;
  };
}

function errorFromResponse(status: number, payload: unknown): ApiError {
  const error = (payload as ErrorPayload | null)?.error;
  const code = typeof error?.code === "string" ? error.code : "request_failed";
  const message =
    typeof error?.message === "string"
      ? error.message
      : "リクエストを完了できませんでした";
  return new ApiError(status, code, message);
}

export class HttpGameApiClient implements GameApiClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  private async request<T>(
    path: string,
    accessToken: string,
    init: RequestInit,
    signal?: AbortSignal,
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(path, {
        ...init,
        signal,
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...init.headers,
        },
      });
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      throw new ApiError(
        null,
        "network_error",
        "サーバーに接続できませんでした",
      );
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      if (!response.ok) {
        throw new ApiError(
          response.status,
          "invalid_response",
          "サーバーから正しい応答を受信できませんでした",
        );
      }
    }

    if (!response.ok) {
      throw errorFromResponse(response.status, payload);
    }
    return payload as T;
  }

  bootstrap(
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<BootstrapResponse> {
    return this.request<BootstrapResponse>(
      "/api/bootstrap",
      accessToken,
      { method: "GET" },
      signal,
    );
  }

  onboard(
    accessToken: string,
    input: OnboardingInput,
    signal?: AbortSignal,
  ): Promise<ReadyBootstrapResponse> {
    return this.request<ReadyBootstrapResponse>(
      "/api/onboarding",
      accessToken,
      { method: "POST", body: JSON.stringify(input) },
      signal,
    );
  }

  applyAction(
    accessToken: string,
    request: GameActionRequest,
    signal?: AbortSignal,
  ): Promise<GameActionResponse> {
    return this.request<GameActionResponse>(
      "/api/game/action",
      accessToken,
      { method: "POST", body: JSON.stringify(request) },
      signal,
    );
  }
}
