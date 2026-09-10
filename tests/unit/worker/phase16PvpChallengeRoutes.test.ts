import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type {
  CloudGameSnapshot,
  GameStore,
} from "../../../worker/data/GameStore";
import type {
  CommitRatedPvpMatchInput,
  CommittedRatedPvpMatch,
  PersistedPvpMatchSession,
  PublishedPvpTeamSnapshot,
  PvpMatchSessionStore,
} from "../../../worker/data/PvPStore";
import { createRouter } from "../../../worker/router";
import { createPvpChallengeHandler } from "../../../worker/routes/pvpChallenge";

const challengerUserId = "00000000-0000-0000-0000-000000000001";
const defenderUserId = "00000000-0000-0000-0000-000000000002";
const defenderSnapshotId = "00000000-0000-4000-8000-000000000222";

function challengerSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase16-route-challenger",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高橋 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
  return {
    userId: challengerUserId,
    schoolDbId: "00000000-0000-4000-8000-000000000111",
    revision: 12,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function defenderSnapshot(): PublishedPvpTeamSnapshot {
  const state = createInitialGame({
    seed: "phase16-route-defender",
    schoolName: "白波高校",
    schoolShortName: "白波",
    coachName: "山本 監督",
    regionId: "region.kanagawa",
    uniform: {
      primary: "#224466",
      secondary: "#F7F7F7",
      accent: "#BB7722",
    },
  });
  const school = state.schools[state.userSchoolId]!;
  return {
    id: defenderSnapshotId,
    userId: defenderUserId,
    sourceRevision: 7,
    sourceAcademicYear: state.calendar.academicYear,
    sourceYearIndex: state.yearIndex,
    school: structuredClone(school),
    players: Object.fromEntries(
      school.playerIds.map((id) => [id, structuredClone(state.players[id]!)]),
    ),
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
    isActive: true,
    publishedAt: "2026-09-10T09:00:00.000Z",
  };
}

function gameStore(snapshot: CloudGameSnapshot): GameStore {
  return {
    getSnapshot: vi.fn(async (userId) =>
      userId === snapshot.userId ? snapshot : null,
    ),
    getOperationResponse: vi.fn(async () => null),
    createGame: vi.fn(async () => {
      throw new Error("not used");
    }),
    applyOperation: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

function unusedCommittedMatch(
  input: CommitRatedPvpMatchInput,
): CommittedRatedPvpMatch {
  return {
    matchId: "00000000-0000-4000-8000-000000000333",
    seasonId: input.seasonId,
    operationId: input.operationId,
    challengerUserId: input.challengerUserId,
    defenderUserId: input.defenderUserId,
    defenderSnapshotId: input.defenderSnapshotId,
    winnerUserId: input.challengerUserId,
    challengerRatingBefore: 1000,
    challengerRatingAfter: 1016,
    defenderRatingBefore: 1000,
    defenderRatingAfter: 984,
    result: input.result,
    createdAt: "2026-09-10T09:30:00.000Z",
  };
}

function sessionStore(
  defender: PublishedPvpTeamSnapshot,
): PvpMatchSessionStore {
  return {
    publishSnapshot: vi.fn(async () => defender),
    findChallengeOperation: vi.fn(async () => null),
    getSnapshotById: vi.fn(async () => defender),
    commitRatedMatch: vi.fn(async (input) => unusedCommittedMatch(input)),
    listOpponents: vi.fn(async () => []),
    listRanking: vi.fn(async () => []),
    listHistory: vi.fn(async () => []),
    createMatchSession: vi.fn(
      async (input): Promise<PersistedPvpMatchSession> => ({
        challengerUserId: input.challengerUserId,
        operationId: input.operationId,
        defenderSnapshotId: input.defenderSnapshotId,
        challengerSourceRevision: input.challengerSourceRevision,
        currentCursor: input.currentCursor,
        privateSession: input.privateSession,
        publicResponse: input.publicResponse,
        finalResponse: null,
        createdAt: "2026-09-10T09:30:00.000Z",
        updatedAt: "2026-09-10T09:30:00.000Z",
      }),
    ),
    getMatchSession: vi.fn(async () => null),
    getMatchSessionCommandReceipt: vi.fn(async () => null),
    saveMatchSessionCommand: vi.fn(async () => {
      throw new Error("not used");
    }),
    storeMatchSessionFinalResponse: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

function challengeRequest(): Request {
  return new Request("https://court-legacy.test/api/pvp/challenge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "phase16-route-operation",
      revision: 12,
      opponentSnapshotId: defenderSnapshotId,
    }),
  });
}

function authenticatedRequest(path: string, init?: RequestInit): Request {
  return new Request(`https://court-legacy.test${path}`, {
    ...init,
    headers: {
      authorization: "Bearer access-token",
      ...(init?.headers ?? {}),
    },
  });
}

describe("Phase 16 PvP challenge routes", () => {
  it("starts one private resumable session and does not commit rating before match completion", async () => {
    const challenger = challengerSnapshot();
    const defender = defenderSnapshot();
    const store = sessionStore(defender);
    const handler = createPvpChallengeHandler({
      gameStore: gameStore(challenger),
      pvpStore: store,
      now: () => new Date("2026-09-10T09:30:00.000Z"),
      createMatchNonce: () => "fixed-route-nonce",
    });

    const response = await handler(challengeRequest(), {
      id: challengerUserId,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "in-progress",
      operationId: "phase16-route-operation",
      revision: 12,
      seasonId: "2026-09",
      opponent: {
        snapshotId: defenderSnapshotId,
        schoolName: "白波高校",
        schoolShortName: "白波",
      },
      segment: {
        status: "in-progress",
        operationId: "phase16-route-operation",
        phase: "coach-decision",
      },
    });
    expect(store.createMatchSession).toHaveBeenCalledTimes(1);
    expect(store.commitRatedMatch).not.toHaveBeenCalled();

    const serialized = JSON.stringify(body);
    for (const forbidden of [
      "abilities",
      "hiddenTraitIds",
      "runtime",
      "homeSelection",
      "awaySelection",
      "actorPlayerId",
      "targetPlayerId",
      "serveTargetPlayerId",
      "defender:",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("reloads only the authenticated challenger's persisted public session response", async () => {
    const challenger = challengerSnapshot();
    const defender = defenderSnapshot();
    const store = sessionStore(defender);
    const publicResponse = {
      status: "in-progress",
      operationId: "phase16-route-operation",
      revision: 12,
      seasonId: "2026-09",
      opponent: {
        snapshotId: defenderSnapshotId,
        schoolName: "白波高校",
        schoolShortName: "白波",
      },
      segment: {
        status: "in-progress",
        operationId: "phase16-route-operation",
        matchId: "pvp-match-1",
        phase: "coach-decision",
        currentSetNumber: 1,
        challengerSetsWon: 0,
        defenderSetsWon: 0,
        currentScore: { challenger: 10, defender: 14 },
        sets: [],
        pendingDecisionReason: "opponent-run",
        events: [],
      },
    };
    vi.mocked(store.getMatchSession).mockResolvedValue({
      challengerUserId,
      operationId: "phase16-route-operation",
      defenderSnapshotId,
      challengerSourceRevision: 12,
      currentCursor: 42,
      privateSession: { secret: "server-only" },
      publicResponse,
      finalResponse: null,
      createdAt: "2026-09-10T09:30:00.000Z",
      updatedAt: "2026-09-10T09:31:00.000Z",
    });
    const router = createRouter({
      verifyAccessToken: vi.fn(async () => ({ id: challengerUserId })),
      store: gameStore(challenger),
      pvpStore: store,
    });

    const response = await router(
      authenticatedRequest(
        "/api/pvp/challenge/session?operationId=phase16-route-operation",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(publicResponse);
    expect(store.getMatchSession).toHaveBeenCalledWith(
      challengerUserId,
      "phase16-route-operation",
    );
  });

  it("replays an accepted duplicate command from its receipt before loading or resimulating the private session", async () => {
    const challenger = challengerSnapshot();
    const defender = defenderSnapshot();
    const store = sessionStore(defender);
    const replayResponse = {
      status: "in-progress",
      operationId: "phase16-route-operation",
      revision: 12,
      seasonId: "2026-09",
      opponent: {
        snapshotId: defenderSnapshotId,
        schoolName: "白波高校",
        schoolShortName: "白波",
      },
      segment: {
        status: "in-progress",
        operationId: "phase16-route-operation",
        matchId: "pvp-match-1",
        phase: "coach-decision",
        currentSetNumber: 2,
        challengerSetsWon: 1,
        defenderSetsWon: 0,
        currentScore: { challenger: 6, defender: 4 },
        sets: [
          {
            setNumber: 1,
            challengerScore: 25,
            defenderScore: 20,
            completed: true,
            winner: "challenger",
          },
        ],
        pendingDecisionReason: "opponent-run",
        events: [],
      },
    };
    vi.mocked(store.getMatchSessionCommandReceipt).mockResolvedValue({
      commandId: "command-001",
      command: { type: "continue" },
      publicResponse: replayResponse,
    });
    const router = createRouter({
      verifyAccessToken: vi.fn(async () => ({ id: challengerUserId })),
      store: gameStore(challenger),
      pvpStore: store,
    });

    const response = await router(
      authenticatedRequest("/api/pvp/challenge/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: "phase16-route-operation",
          commandId: "command-001",
          command: { type: "continue" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(replayResponse);
    expect(store.getMatchSessionCommandReceipt).toHaveBeenCalledWith(
      challengerUserId,
      "phase16-route-operation",
      "command-001",
    );
    expect(store.getMatchSession).not.toHaveBeenCalled();
    expect(store.saveMatchSessionCommand).not.toHaveBeenCalled();
    expect(store.commitRatedMatch).not.toHaveBeenCalled();
  });
});
