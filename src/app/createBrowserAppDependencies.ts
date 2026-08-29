import type {
  CloudGameSnapshot,
  PersistedOperationResponse,
} from "../../worker/data/GameStore";
import type { GameActionRequest } from "../../worker/game/actionSchema";
import { applyGameAction } from "../../worker/game/applyGameAction";
import type { GameState } from "../domain/model/GameState";
import { playerId } from "../domain/model/identifiers";
import type {
  PvpChallengeRequest,
  PvpHistoryEntry,
  PvpListRequestQuery,
  PvpOpponentSummary,
  PvpPublishedTeamSummary,
  PvpPublishRequest,
  PvpRankingEntry,
} from "../domain/pvp/pvpContracts";
import type { ScoutReport } from "../domain/scouting/scoutReport";
import type {
  ShopPurchaseRequest,
  ShopUseRequest,
} from "../domain/shop/shopContracts";
import { autoSelectTeam } from "../domain/team/autoSelectTeam";
import type { AuthClient } from "../services/auth/AuthClient";
import {
  E2E_AUTH_SESSION,
  MockAuthClient,
} from "../services/auth/MockAuthClient";
import { createSupabaseAuthClient } from "../services/auth/SupabaseAuthClient";
import {
  ApiError,
  HttpGameApiClient,
  type GameApiClient,
  type OnboardingInput,
  type ScoutingBoardRequest,
  type ScoutingRecruitmentRequest,
} from "../services/api/GameApiClient";
import { createDemoGame } from "./createDemoGame";
import { createInitialGame } from "./createInitialGame";
import { StaticShopHarness } from "./StaticShopHarness";

interface BrowserAppEnvironment {
  MODE?: string;
  VITE_E2E_AUTH_BYPASS?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export interface BrowserAppDependencies {
  auth: AuthClient;
  api: GameApiClient;
}

export const E2E_SERVER_SNAPSHOT_KEY = "court-legacy:e2e-server-snapshot";
export const E2E_GAME_STATE_KEY = "court-legacy:e2e-game-state";
export const E2E_ACTION_DELAY_MS_KEY = "court-legacy:e2e-action-delay-ms";

function createHarnessSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: E2E_AUTH_SESSION.userId,
    schoolDbId: "e2e-school",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function harnessScoutingCycleKey(state: GameState): string {
  return `${state.userSchoolId}:year-${state.yearIndex}`;
}

function createHarnessScoutReports(cycleKey: string): ScoutReport[] {
  return [
    {
      candidateId: playerId(`${cycleKey}:candidate-1`),
      displayName: "青木 蓮",
      heightCm: 188,
      position: "OH",
      handedness: "right",
      middleSchoolAchievement: "prefectural-selection",
      evaluationStars: 4,
      estimatedOverall: { min: 58, max: 72 },
      estimatedPotential: { min: 72, max: 89 },
      confidence: "medium",
      comments: ["攻撃力に目を引くものがある", "高さは武器になりそう"],
    },
    {
      candidateId: playerId(`${cycleKey}:candidate-2`),
      displayName: "佐藤 湊",
      heightCm: 193,
      position: "MB",
      handedness: "right",
      middleSchoolAchievement: "prefectural-best-eight",
      evaluationStars: 3,
      estimatedOverall: { min: 52, max: 67 },
      estimatedPotential: { min: 66, max: 84 },
      confidence: "medium",
      comments: ["ブロックの伸びしろがある", "高さを生かした成長に期待"],
    },
    {
      candidateId: playerId(`${cycleKey}:candidate-3`),
      displayName: "高橋 悠真",
      heightCm: 181,
      position: "S",
      handedness: "right",
      middleSchoolAchievement: "regional-starter",
      evaluationStars: 3,
      estimatedOverall: { min: 50, max: 65 },
      estimatedPotential: { min: 65, max: 82 },
      confidence: "high",
      comments: ["トスワークが安定している", "ゲームメイクに落ち着きがある"],
    },
    {
      candidateId: playerId(`${cycleKey}:candidate-4`),
      displayName: "森田 颯太",
      heightCm: 187,
      position: "OP",
      handedness: "left",
      middleSchoolAchievement: "unknown",
      evaluationStars: 2,
      estimatedOverall: { min: 45, max: 63 },
      estimatedPotential: { min: 61, max: 81 },
      confidence: "low",
      comments: ["左利きの攻撃に特徴がある", "情報が少なく継続調査が必要"],
    },
    {
      candidateId: playerId(`${cycleKey}:candidate-5`),
      displayName: "小林 陽斗",
      heightCm: 174,
      position: "L",
      handedness: "right",
      middleSchoolAchievement: "prefectural-selection",
      evaluationStars: 4,
      estimatedOverall: { min: 57, max: 70 },
      estimatedPotential: { min: 68, max: 83 },
      confidence: "high",
      comments: ["レシーブ範囲が広い", "守備の判断が早い"],
    },
    {
      candidateId: playerId(`${cycleKey}:candidate-6`),
      displayName: "伊藤 大和",
      heightCm: 190,
      position: "OH",
      handedness: "right",
      middleSchoolAchievement: "national-event",
      evaluationStars: 5,
      estimatedOverall: { min: 64, max: 76 },
      estimatedPotential: { min: 78, max: 92 },
      confidence: "medium",
      comments: ["全国レベルの経験がある", "攻守ともに高い水準が見込める"],
    },
  ];
}

const HARNESS_PVP_SEASON_ID = "2026-08";

function createHarnessPvpOpponents(): PvpOpponentSummary[] {
  return [
    {
      snapshotId: "00000000-0000-4000-8000-000000000201",
      schoolName: "白波高校",
      schoolShortName: "白波",
      reputationRank: "A",
      teamPower: 76,
      academicYear: 2026,
      publishedAt: "2026-08-28T07:05:00.000Z",
      rating: 1048,
      wins: 12,
      losses: 7,
      currentWinStreak: 3,
    },
    {
      snapshotId: "00000000-0000-4000-8000-000000000202",
      schoolName: "東雲工業",
      schoolShortName: "東雲",
      reputationRank: "B",
      teamPower: 72,
      academicYear: 2026,
      publishedAt: "2026-08-28T06:40:00.000Z",
      rating: 1019,
      wins: 9,
      losses: 8,
      currentWinStreak: 1,
    },
    {
      snapshotId: "00000000-0000-4000-8000-000000000203",
      schoolName: "海星学院",
      schoolShortName: "海星",
      reputationRank: "C",
      teamPower: 68,
      academicYear: 2026,
      publishedAt: "2026-08-28T06:10:00.000Z",
      rating: 982,
      wins: 7,
      losses: 10,
      currentWinStreak: 0,
    },
  ];
}

function readSessionStorage(key: string): string | null {
  try {
    return globalThis.sessionStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeSessionStorage(key: string, value: string): void {
  try {
    globalThis.sessionStorage?.setItem(key, value);
  } catch {
    // E2E persistence is only a browser test adapter; in-memory state still works.
  }
}

function readPersistedHarnessSnapshot(): CloudGameSnapshot | null {
  try {
    const raw = readSessionStorage(E2E_SERVER_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as CloudGameSnapshot) : null;
  } catch {
    return null;
  }
}

function writePersistedHarnessSnapshot(snapshot: CloudGameSnapshot): void {
  writeSessionStorage(E2E_SERVER_SNAPSHOT_KEY, JSON.stringify(snapshot));
  writeSessionStorage(E2E_GAME_STATE_KEY, "ready");
}

function readHarnessDelay(): number {
  const parsed = Number(readSessionStorage(E2E_ACTION_DELAY_MS_KEY) ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 5_000)) : 0;
}

class StaticGameApiClient implements GameApiClient {
  private snapshot: CloudGameSnapshot | null;
  private readonly operationResponses = new Map<
    string,
    PersistedOperationResponse
  >();
  private readonly scoutingReports = new Map<string, ScoutReport[]>();
  private readonly pvpOpponents = createHarnessPvpOpponents();
  private readonly shopHarness: StaticShopHarness;
  private pvpRating = 1000;
  private pvpHistory: PvpHistoryEntry[] = [];

  constructor(private readonly persistAcrossReloads: boolean) {
    const explicitGameState = persistAcrossReloads
      ? readSessionStorage(E2E_GAME_STATE_KEY)
      : null;
    this.snapshot =
      explicitGameState === "needs-onboarding"
        ? null
        : ((persistAcrossReloads ? readPersistedHarnessSnapshot() : null) ??
          createHarnessSnapshot());
    this.shopHarness = new StaticShopHarness({
      getGame: () => {
        const snapshot = this.requireSnapshot();
        return {
          revision: snapshot.revision,
          yearIndex: snapshot.state.yearIndex,
        };
      },
      commitRevision: (revision) => {
        const snapshot = this.requireSnapshot();
        this.replaceSnapshot({ ...snapshot, revision });
      },
    });
    if (persistAcrossReloads && this.snapshot) {
      writePersistedHarnessSnapshot(this.snapshot);
    }
  }

  private replaceSnapshot(next: CloudGameSnapshot): void {
    this.snapshot = next;
    if (this.persistAcrossReloads) {
      writePersistedHarnessSnapshot(next);
    }
  }

  private requireSnapshot(): CloudGameSnapshot {
    if (!this.snapshot) {
      throw new ApiError(
        409,
        "game_not_ready",
        "学校データを作成してから操作してください",
      );
    }
    return this.snapshot;
  }

  async bootstrap() {
    return this.snapshot
      ? ({ status: "ready" as const, game: this.snapshot } as const)
      : ({ status: "needs-onboarding" as const } as const);
  }

  async onboard(_accessToken: string, input: OnboardingInput) {
    const state = createInitialGame({
      seed: `e2e:${input.schoolName}:${input.coachName}`,
      schoolName: input.schoolName,
      schoolShortName: input.schoolShortName,
      coachName: input.coachName,
      regionId: input.regionId,
      uniform: {
        primary: "#17365D",
        secondary: "#FFFFFF",
        accent: "#D99B2B",
      },
    });
    const game: CloudGameSnapshot = {
      userId: E2E_AUTH_SESSION.userId,
      schoolDbId: "e2e-school",
      revision: 1,
      state,
      teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
    };
    this.replaceSnapshot(game);
    return { status: "ready" as const, game };
  }

  async applyAction(_accessToken: string, request: GameActionRequest) {
    const snapshot = this.requireSnapshot();

    const cached = this.operationResponses.get(request.operationId);
    if (cached) {
      return cached;
    }
    if (request.revision !== snapshot.revision) {
      throw new ApiError(
        409,
        "revision_conflict",
        "別の操作でテスト用データが更新されています",
      );
    }

    if (this.persistAcrossReloads) {
      const delay = readHarnessDelay();
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    const applied = applyGameAction(snapshot, request.action);
    this.replaceSnapshot({
      ...snapshot,
      revision: snapshot.revision + 1,
      state: applied.state,
      teamSelection: applied.teamSelection,
    });
    const response: PersistedOperationResponse = {
      game: this.snapshot!,
      operationId: request.operationId,
    };
    if (applied.outcome !== undefined) {
      response.outcome = applied.outcome;
    }
    this.operationResponses.set(request.operationId, response);
    return response;
  }

  async getShop(_accessToken: string) {
    return this.shopHarness.getStatus();
  }

  async purchaseShopItem(
    _accessToken: string,
    request: ShopPurchaseRequest,
  ) {
    return this.shopHarness.purchase(request);
  }

  async useShopItem(_accessToken: string, request: ShopUseRequest) {
    return this.shopHarness.use(request);
  }

  async getScoutingBoard(_accessToken: string, request: ScoutingBoardRequest) {
    const snapshot = this.requireSnapshot();
    if (request.revision !== snapshot.revision) {
      throw new ApiError(
        409,
        "revision_conflict",
        "別の操作でテスト用データが更新されています",
      );
    }

    const cycleKey = harnessScoutingCycleKey(snapshot.state);
    let reports = this.scoutingReports.get(cycleKey);
    if (!reports) {
      reports = createHarnessScoutReports(cycleKey);
      this.scoutingReports.set(cycleKey, reports);
    }

    return {
      operationId: request.operationId,
      revision: snapshot.revision,
      cycleKey,
      reports,
    };
  }

  async commitRecruit(
    _accessToken: string,
    request: ScoutingRecruitmentRequest,
  ) {
    const snapshot = this.requireSnapshot();
    if (request.revision !== snapshot.revision) {
      throw new ApiError(
        409,
        "revision_conflict",
        "別の操作でテスト用データが更新されています",
      );
    }

    const cycleKey = harnessScoutingCycleKey(snapshot.state);
    const reports = this.scoutingReports.get(cycleKey);
    if (!reports) {
      throw new ApiError(
        409,
        "scouting_board_required",
        "先にスカウト候補を確認してください",
      );
    }
    if (!reports.some((report) => report.candidateId === request.candidateId)) {
      throw new ApiError(
        409,
        "candidate_unavailable",
        "この候補は現在のスカウト候補に含まれていません",
      );
    }

    const currentCommitments =
      snapshot.state.recruiting?.cycleKey === cycleKey
        ? snapshot.state.recruiting.committedCandidateIds
        : [];
    if (currentCommitments.includes(request.candidateId)) {
      throw new ApiError(
        409,
        "candidate_already_committed",
        "この候補はすでに獲得済みです",
      );
    }

    const committedCandidateIds = [...currentCommitments, request.candidateId];
    const game: CloudGameSnapshot = {
      ...snapshot,
      revision: snapshot.revision + 1,
      state: {
        ...snapshot.state,
        recruiting: {
          cycleKey,
          committedCandidateIds,
        },
      },
    };
    this.replaceSnapshot(game);

    return {
      game,
      operationId: request.operationId,
      outcome: {
        candidateId: request.candidateId,
        committedCandidateIds,
        cycleKey,
      },
    };
  }

  private async pvpDelay(): Promise<void> {
    if (!this.persistAcrossReloads) return;
    const delay = readHarnessDelay();
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  async publishPvpTeam(_accessToken: string, request: PvpPublishRequest) {
    const snapshot = this.requireSnapshot();
    if (request.revision !== snapshot.revision) {
      throw new ApiError(
        409,
        "revision_conflict",
        "別の操作でテスト用データが更新されています",
      );
    }
    await this.pvpDelay();
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const team: PvpPublishedTeamSummary = {
      snapshotId: "00000000-0000-4000-8000-000000000101",
      schoolName: school.name,
      schoolShortName: school.shortName,
      reputationRank: "B",
      teamPower: 71,
      academicYear: snapshot.state.calendar.academicYear,
      publishedAt: new Date().toISOString(),
    };
    return {
      operationId: request.operationId,
      revision: snapshot.revision,
      team,
    };
  }

  async getPvpOpponents(_accessToken: string, query?: PvpListRequestQuery) {
    await this.pvpDelay();
    const limit = Math.max(1, Math.min(query?.limit ?? 20, 30));
    return {
      seasonId: HARNESS_PVP_SEASON_ID,
      opponents: this.pvpOpponents.slice(0, limit),
      nextCursor: null,
    };
  }

  async getPvpRanking(_accessToken: string, query?: PvpListRequestQuery) {
    await this.pvpDelay();
    const limit = Math.max(1, Math.min(query?.limit ?? 20, 30));
    const ranking: PvpRankingEntry[] = this.pvpOpponents.map(
      (opponent, index) => ({
        rank: index + 1,
        snapshotId: opponent.snapshotId,
        schoolName: opponent.schoolName,
        schoolShortName: opponent.schoolShortName,
        rating: opponent.rating,
        matches: opponent.wins + opponent.losses,
        wins: opponent.wins,
        losses: opponent.losses,
        currentWinStreak: opponent.currentWinStreak,
      }),
    );
    return {
      seasonId: HARNESS_PVP_SEASON_ID,
      ranking: ranking.slice(0, limit),
      nextCursor: null,
    };
  }

  async getPvpHistory(_accessToken: string, query?: PvpListRequestQuery) {
    await this.pvpDelay();
    const limit = Math.max(1, Math.min(query?.limit ?? 20, 30));
    return {
      seasonId: HARNESS_PVP_SEASON_ID,
      history: this.pvpHistory.slice(0, limit),
      nextCursor: null,
    };
  }

  async challengePvpTeam(_accessToken: string, request: PvpChallengeRequest) {
    const snapshot = this.requireSnapshot();
    if (request.revision !== snapshot.revision) {
      throw new ApiError(
        409,
        "revision_conflict",
        "別の操作でテスト用データが更新されています",
      );
    }
    const opponent = this.pvpOpponents.find(
      (candidate) => candidate.snapshotId === request.opponentSnapshotId,
    );
    if (!opponent) {
      throw new ApiError(
        404,
        "pvp_opponent_unavailable",
        "対戦相手が見つかりません",
      );
    }
    await this.pvpDelay();

    const before = this.pvpRating;
    const after = before + 16;
    this.pvpRating = after;
    const matchId = `00000000-0000-4000-8000-${String(
      this.pvpHistory.length + 301,
    ).padStart(12, "0")}`;
    const createdAt = new Date().toISOString();
    const result = {
      outcome: "win" as const,
      challengerSetsWon: 2,
      defenderSetsWon: 1,
      sets: [
        { setNumber: 1, challengerScore: 25, defenderScore: 20 },
        { setNumber: 2, challengerScore: 22, defenderScore: 25 },
        { setNumber: 3, challengerScore: 25, defenderScore: 18 },
      ],
    };
    const history: PvpHistoryEntry = {
      matchId,
      createdAt,
      opponentSnapshotId: opponent.snapshotId,
      opponentSchoolName: opponent.schoolName,
      perspective: "challenger",
      outcome: result.outcome,
      ratingBefore: before,
      ratingAfter: after,
      result,
    };
    this.pvpHistory = [history, ...this.pvpHistory];

    return {
      operationId: request.operationId,
      revision: snapshot.revision,
      seasonId: HARNESS_PVP_SEASON_ID,
      matchId,
      opponent: {
        snapshotId: opponent.snapshotId,
        schoolName: opponent.schoolName,
        schoolShortName: opponent.schoolShortName,
      },
      rating: { before, after, delta: after - before },
      result,
      createdAt,
    };
  }
}

class UnavailableAuthClient implements AuthClient {
  private error(): Error {
    return new Error(
      "認証設定が見つかりません。Supabaseの公開設定を確認してください。",
    );
  }

  async getSession(): Promise<null> {
    throw this.error();
  }

  subscribe(): () => void {
    return () => undefined;
  }

  async signInWithGoogle(): Promise<void> {
    throw this.error();
  }

  async signInWithEmail(): Promise<void> {
    throw this.error();
  }

  async signOut(): Promise<void> {
    throw this.error();
  }
}

function browserEnvironment(): BrowserAppEnvironment {
  return {
    MODE: import.meta.env.MODE,
    VITE_E2E_AUTH_BYPASS: import.meta.env.VITE_E2E_AUTH_BYPASS,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env
      .VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function createBrowserAppDependencies(
  env: BrowserAppEnvironment = browserEnvironment(),
): BrowserAppDependencies {
  if (env.MODE === "test") {
    return {
      auth: new MockAuthClient(),
      api: new StaticGameApiClient(false),
    };
  }

  if (env.VITE_E2E_AUTH_BYPASS === "true") {
    return {
      auth: new MockAuthClient({ persistAcrossReloads: true }),
      api: new StaticGameApiClient(true),
    };
  }

  const api = new HttpGameApiClient();
  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    return { auth: new UnavailableAuthClient(), api };
  }

  return {
    auth: createSupabaseAuthClient({
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    }),
    api,
  };
}
