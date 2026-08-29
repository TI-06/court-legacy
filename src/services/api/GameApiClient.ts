import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import type {
  GameActionRequest,
  GameActionResponse,
} from "../../../worker/game/actionSchema";
import type { PlayerId } from "../../domain/model/identifiers";
import type {
  PvpChallengeRequest,
  PvpChallengeResponse,
  PvpHistoryResponse,
  PvpListRequestQuery,
  PvpOpponentsResponse,
  PvpPublishRequest,
  PvpPublishResponse,
  PvpRankingResponse,
} from "../../domain/pvp/pvpContracts";
import type { ScoutReport } from "../../domain/scouting/scoutReport";
import type {
  ShopPurchaseRequest,
  ShopPurchaseResponse,
  ShopStatusResponse,
  ShopUseRequest,
  ShopUseResponse,
} from "../../domain/shop/shopContracts";

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

export interface ScoutingBoardRequest {
  operationId: string;
  revision: number;
}

export interface ScoutingBoardResponse {
  operationId: string;
  revision: number;
  cycleKey: string;
  reports: ScoutReport[];
}

export interface ScoutingRecruitmentRequest {
  operationId: string;
  revision: number;
  candidateId: PlayerId;
}

export interface ScoutingRecruitmentResponse {
  operationId: string;
  game: CloudGameSnapshot;
  outcome: {
    candidateId: PlayerId;
    committedCandidateIds: PlayerId[];
    cycleKey: string;
  };
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
  getShop?(
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<ShopStatusResponse>;
  purchaseShopItem?(
    accessToken: string,
    request: ShopPurchaseRequest,
    signal?: AbortSignal,
  ): Promise<ShopPurchaseResponse>;
  useShopItem?(
    accessToken: string,
    request: ShopUseRequest,
    signal?: AbortSignal,
  ): Promise<ShopUseResponse>;
  getScoutingBoard?(
    accessToken: string,
    request: ScoutingBoardRequest,
    signal?: AbortSignal,
  ): Promise<ScoutingBoardResponse>;
  commitRecruit?(
    accessToken: string,
    request: ScoutingRecruitmentRequest,
    signal?: AbortSignal,
  ): Promise<ScoutingRecruitmentResponse>;
  publishPvpTeam?(
    accessToken: string,
    request: PvpPublishRequest,
    signal?: AbortSignal,
  ): Promise<PvpPublishResponse>;
  getPvpOpponents?(
    accessToken: string,
    query?: PvpListRequestQuery,
    signal?: AbortSignal,
  ): Promise<PvpOpponentsResponse>;
  challengePvpTeam?(
    accessToken: string,
    request: PvpChallengeRequest,
    signal?: AbortSignal,
  ): Promise<PvpChallengeResponse>;
  getPvpRanking?(
    accessToken: string,
    query?: PvpListRequestQuery,
    signal?: AbortSignal,
  ): Promise<PvpRankingResponse>;
  getPvpHistory?(
    accessToken: string,
    query?: PvpListRequestQuery,
    signal?: AbortSignal,
  ): Promise<PvpHistoryResponse>;
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

function pvpListPath(path: string, query?: PvpListRequestQuery): string {
  if (!query) return path;

  const params = new URLSearchParams();
  if (query.cursor) {
    params.set("cursor", query.cursor);
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  const encoded = params.toString();
  return encoded ? `${path}?${encoded}` : path;
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

  getShop(
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<ShopStatusResponse> {
    return this.request<ShopStatusResponse>(
      "/api/shop",
      accessToken,
      { method: "GET" },
      signal,
    );
  }

  purchaseShopItem(
    accessToken: string,
    request: ShopPurchaseRequest,
    signal?: AbortSignal,
  ): Promise<ShopPurchaseResponse> {
    return this.request<ShopPurchaseResponse>(
      "/api/shop/purchase",
      accessToken,
      { method: "POST", body: JSON.stringify(request) },
      signal,
    );
  }

  useShopItem(
    accessToken: string,
    request: ShopUseRequest,
    signal?: AbortSignal,
  ): Promise<ShopUseResponse> {
    return this.request<ShopUseResponse>(
      "/api/shop/use",
      accessToken,
      { method: "POST", body: JSON.stringify(request) },
      signal,
    );
  }

  getScoutingBoard(
    accessToken: string,
    request: ScoutingBoardRequest,
    signal?: AbortSignal,
  ): Promise<ScoutingBoardResponse> {
    return this.request<ScoutingBoardResponse>(
      "/api/scouting/board",
      accessToken,
      { method: "POST", body: JSON.stringify(request) },
      signal,
    );
  }

  commitRecruit(
    accessToken: string,
    request: ScoutingRecruitmentRequest,
    signal?: AbortSignal,
  ): Promise<ScoutingRecruitmentResponse> {
    return this.request<ScoutingRecruitmentResponse>(
      "/api/scouting/recruit",
      accessToken,
      { method: "POST", body: JSON.stringify(request) },
      signal,
    );
  }

  publishPvpTeam(
    accessToken: string,
    request: PvpPublishRequest,
    signal?: AbortSignal,
  ): Promise<PvpPublishResponse> {
    return this.request<PvpPublishResponse>(
      "/api/pvp/team/publish",
      accessToken,
      { method: "POST", body: JSON.stringify(request) },
      signal,
    );
  }

  getPvpOpponents(
    accessToken: string,
    query?: PvpListRequestQuery,
    signal?: AbortSignal,
  ): Promise<PvpOpponentsResponse> {
    return this.request<PvpOpponentsResponse>(
      pvpListPath("/api/pvp/opponents", query),
      accessToken,
      { method: "GET" },
      signal,
    );
  }

  challengePvpTeam(
    accessToken: string,
    request: PvpChallengeRequest,
    signal?: AbortSignal,
  ): Promise<PvpChallengeResponse> {
    return this.request<PvpChallengeResponse>(
      "/api/pvp/challenge",
      accessToken,
      { method: "POST", body: JSON.stringify(request) },
      signal,
    );
  }

  getPvpRanking(
    accessToken: string,
    query?: PvpListRequestQuery,
    signal?: AbortSignal,
  ): Promise<PvpRankingResponse> {
    return this.request<PvpRankingResponse>(
      pvpListPath("/api/pvp/ranking", query),
      accessToken,
      { method: "GET" },
      signal,
    );
  }

  getPvpHistory(
    accessToken: string,
    query?: PvpListRequestQuery,
    signal?: AbortSignal,
  ): Promise<PvpHistoryResponse> {
    return this.request<PvpHistoryResponse>(
      pvpListPath("/api/pvp/history", query),
      accessToken,
      { method: "GET" },
      signal,
    );
  }
}
