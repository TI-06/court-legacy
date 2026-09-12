import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import type {
  GameActionRequest,
  GameActionResponse,
} from "../../../worker/game/actionSchema";
import type { PlayerId } from "../../domain/model/identifiers";
import type {
  PvpChallengeCommandRequest,
  PvpChallengeRequest,
  PvpChallengeSessionResponse,
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

export interface AccountProfile {
  loginId: string;
  coachName: string;
  schoolName: string;
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
  getAccountProfile?(
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<AccountProfile>;
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
  ): Promise<PvpChallengeSessionResponse>;
  getPvpChallengeSession?(
    accessToken: string,
    operationId: string,
    signal?: AbortSignal,
  ): Promise<PvpChallengeSessionResponse>;
  commandPvpChallenge?(
    accessToken: string,
    request: PvpChallengeCommandRequest,
    signal?: AbortSignal,
  ): Promise<PvpChallengeSessionResponse>;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isPvpTeamSelection(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.rotation) || value.rotation.length !== 6)
    return false;
  if (
    !value.rotation.every(
      (item) =>
        isRecord(item) &&
        typeof item.slot === "number" &&
        Number.isInteger(item.slot) &&
        item.slot >= 1 &&
        item.slot <= 6 &&
        typeof item.playerId === "string",
    )
  ) {
    return false;
  }
  if (
    value.liberoPlayerId !== null &&
    typeof value.liberoPlayerId !== "string"
  ) {
    return false;
  }
  if (
    !isStringArray(value.benchPlayerIds) ||
    !isStringArray(value.servingOrderPlayerIds) ||
    !isRecord(value.substitutionPolicy)
  ) {
    return false;
  }
  const policy = value.substitutionPolicy;
  return (
    isStringArray(policy.starterLockPlayerIds) &&
    typeof policy.allowFatigueBenching === "boolean" &&
    typeof policy.allowInjuryBenching === "boolean" &&
    typeof policy.automaticSubstitutions === "boolean" &&
    typeof policy.automaticSetChanges === "boolean"
  );
}

function isPvpTacticPlan(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    ["safe", "balanced", "aggressive"].includes(String(value.serve)) &&
    ["side", "balanced", "quick"].includes(String(value.attack)) &&
    ["commit", "mixed", "read"].includes(String(value.block))
  );
}

function isPvpSide(value: unknown): boolean {
  return value === null || value === "challenger" || value === "defender";
}

function isPvpMatchSegment(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    (value.status !== "in-progress" && value.status !== "complete") ||
    typeof value.operationId !== "string" ||
    typeof value.matchId !== "string" ||
    ![
      "pre-match",
      "set-in-progress",
      "coach-decision",
      "set-complete",
      "match-complete",
    ].includes(String(value.phase)) ||
    typeof value.currentSetNumber !== "number" ||
    typeof value.challengerSetsWon !== "number" ||
    typeof value.defenderSetsWon !== "number" ||
    !isRecord(value.currentScore) ||
    typeof value.currentScore.challenger !== "number" ||
    typeof value.currentScore.defender !== "number" ||
    !isPvpTeamSelection(value.challengerSelection) ||
    !isPvpTacticPlan(value.challengerTactics) ||
    typeof value.timeoutAvailable !== "boolean" ||
    !Array.isArray(value.sets) ||
    !Array.isArray(value.events)
  ) {
    return false;
  }
  if (
    value.pendingDecisionReason !== null &&
    value.pendingDecisionReason !== "opponent-run" &&
    value.pendingDecisionReason !== "set-break"
  ) {
    return false;
  }
  const setsValid = value.sets.every(
    (set) =>
      isRecord(set) &&
      typeof set.setNumber === "number" &&
      typeof set.challengerScore === "number" &&
      typeof set.defenderScore === "number" &&
      typeof set.completed === "boolean" &&
      isPvpSide(set.winner),
  );
  const eventTypes = new Set([
    "serve",
    "receive",
    "set",
    "attack",
    "block",
    "dig",
    "point",
    "rotation",
    "substitution",
    "timeout",
    "injury",
    "set-end",
    "match-end",
  ]);
  const eventsValid = value.events.every(
    (event) =>
      isRecord(event) &&
      typeof event.sequence === "number" &&
      eventTypes.has(String(event.type)) &&
      typeof event.setNumber === "number" &&
      typeof event.challengerScore === "number" &&
      typeof event.defenderScore === "number" &&
      isPvpSide(event.winner) &&
      typeof event.detailCode === "string",
  );
  return setsValid && eventsValid;
}

function isPvpOpponentIdentity(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.snapshotId === "string" &&
    typeof value.schoolName === "string" &&
    typeof value.schoolShortName === "string"
  );
}

function isPvpCompletedResponse(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.operationId === "string" &&
    typeof value.revision === "number" &&
    typeof value.seasonId === "string" &&
    typeof value.matchId === "string" &&
    isPvpOpponentIdentity(value.opponent) &&
    isRecord(value.rating) &&
    typeof value.rating.before === "number" &&
    typeof value.rating.after === "number" &&
    typeof value.rating.delta === "number" &&
    isRecord(value.result) &&
    (value.result.outcome === "win" || value.result.outcome === "loss") &&
    typeof value.result.challengerSetsWon === "number" &&
    typeof value.result.defenderSetsWon === "number" &&
    Array.isArray(value.result.sets) &&
    typeof value.createdAt === "string"
  );
}

function parsePvpChallengeSessionResponse(
  payload: unknown,
): PvpChallengeSessionResponse {
  if (
    isRecord(payload) &&
    payload.status === "in-progress" &&
    typeof payload.operationId === "string" &&
    typeof payload.revision === "number" &&
    typeof payload.seasonId === "string" &&
    isPvpOpponentIdentity(payload.opponent) &&
    isPvpMatchSegment(payload.segment)
  ) {
    return payload as unknown as PvpChallengeSessionResponse;
  }
  if (isPvpCompletedResponse(payload)) {
    return payload as unknown as PvpChallengeSessionResponse;
  }
  throw new ApiError(
    null,
    "invalid_pvp_response",
    "対人戦の応答を確認できませんでした",
  );
}

const defaultFetch: typeof fetch = (input, init) =>
  globalThis.fetch(input, init);

export class HttpGameApiClient implements GameApiClient {
  constructor(private readonly fetchImpl: typeof fetch = defaultFetch) {}

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

  getAccountProfile(
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<AccountProfile> {
    return this.request<AccountProfile>(
      "/api/account/profile",
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

  async challengePvpTeam(
    accessToken: string,
    request: PvpChallengeRequest,
    signal?: AbortSignal,
  ): Promise<PvpChallengeSessionResponse> {
    const payload = await this.request<unknown>(
      "/api/pvp/challenge",
      accessToken,
      { method: "POST", body: JSON.stringify(request) },
      signal,
    );
    return parsePvpChallengeSessionResponse(payload);
  }

  async getPvpChallengeSession(
    accessToken: string,
    operationId: string,
    signal?: AbortSignal,
  ): Promise<PvpChallengeSessionResponse> {
    const params = new URLSearchParams({ operationId });
    const payload = await this.request<unknown>(
      `/api/pvp/challenge/session?${params.toString()}`,
      accessToken,
      { method: "GET" },
      signal,
    );
    return parsePvpChallengeSessionResponse(payload);
  }

  async commandPvpChallenge(
    accessToken: string,
    request: PvpChallengeCommandRequest,
    signal?: AbortSignal,
  ): Promise<PvpChallengeSessionResponse> {
    const payload = await this.request<unknown>(
      "/api/pvp/challenge/command",
      accessToken,
      { method: "POST", body: JSON.stringify(request) },
      signal,
    );
    return parsePvpChallengeSessionResponse(payload);
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
