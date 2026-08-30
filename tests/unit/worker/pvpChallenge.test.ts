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
  PublishedPvpTeamSnapshot,
  PvPStore,
} from "../../../worker/data/PvPStore";
import { createPvpChallengeHandler } from "../../../worker/routes/pvpChallenge";

const CHALLENGER_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEFENDER_USER_ID = "00000000-0000-0000-0000-000000000002";
const DEFENDER_SNAPSHOT_ID = "00000000-0000-4000-8000-000000000222";

function createCloudSnapshot(revision = 12): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "pvp-challenge-challenger",
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
    userId: CHALLENGER_USER_ID,
    schoolDbId: "00000000-0000-4000-8000-000000000111",
    revision,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function createDefenderSnapshot(
  overrides: Partial<PublishedPvpTeamSnapshot> = {},
): PublishedPvpTeamSnapshot {
  const state = createInitialGame({
    seed: "pvp-challenge-defender",
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
  const players = Object.fromEntries(
    school.playerIds.map((id) => [id, structuredClone(state.players[id]!)]),
  );

  return {
    id: DEFENDER_SNAPSHOT_ID,
    userId: DEFENDER_USER_ID,
    sourceRevision: 7,
    sourceAcademicYear: state.calendar.academicYear,
    sourceYearIndex: state.yearIndex,
    school: structuredClone(school),
    players,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
    isActive: true,
    publishedAt: "2026-08-28T05:00:00.000Z",
    ...overrides,
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

function committedMatch(
  input: CommitRatedPvpMatchInput,
): CommittedRatedPvpMatch {
  return {
    matchId: "00000000-0000-4000-8000-000000000333",
    seasonId: input.seasonId,
    operationId: input.operationId,
    challengerUserId: input.challengerUserId,
    defenderUserId: input.defenderUserId,
    defenderSnapshotId: input.defenderSnapshotId,
    winnerUserId: input.challengerWon
      ? input.challengerUserId
      : input.defenderUserId,
    challengerRatingBefore: 1000,
    challengerRatingAfter: input.challengerWon ? 1016 : 984,
    defenderRatingBefore: 1000,
    defenderRatingAfter: input.challengerWon ? 984 : 1016,
    result: input.result,
    createdAt: "2026-08-28T07:30:00.000Z",
  };
}

function pvpStore(
  defender: PublishedPvpTeamSnapshot | null = createDefenderSnapshot(),
): PvPStore & { committed: CommitRatedPvpMatchInput[] } {
  const store: PvPStore & { committed: CommitRatedPvpMatchInput[] } = {
    committed: [],
    publishSnapshot: vi.fn(async () => {
      throw new Error("not used");
    }),
    findChallengeOperation: vi.fn(async () => null),
    getSnapshotById: vi.fn(async () => defender),
    commitRatedMatch: vi.fn(async (input) => {
      store.committed.push(input);
      return committedMatch(input);
    }),
    listOpponents: vi.fn(async () => []),
    listRanking: vi.fn(async () => []),
    listHistory: vi.fn(async () => []),
  };
  return store;
}

function request(body: unknown): Request {
  return new Request("https://court-legacy.test/api/pvp/challenge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function challengeBody(operationId = "challenge-001") {
  return {
    operationId,
    revision: 12,
    opponentSnapshotId: DEFENDER_SNAPSHOT_ID,
  };
}

describe("PvP challenge route", () => {
  it("simulates from authoritative state and commits only a sanitized server result", async () => {
    const snapshot = createCloudSnapshot();
    const store = pvpStore();
    const handler = createPvpChallengeHandler({
      gameStore: gameStore(snapshot),
      pvpStore: store,
      now: () => new Date("2026-08-28T07:30:00.000Z"),
    });

    const response = await handler(request(challengeBody()), {
      id: CHALLENGER_USER_ID,
    });

    expect(response.status).toBe(200);
    expect(store.committed).toHaveLength(1);
    expect(store.committed[0]).toEqual(
      expect.objectContaining({
        seasonId: "2026-08",
        challengeDayKey: "2026-08-28",
        operationId: "challenge-001",
        challengerUserId: CHALLENGER_USER_ID,
        defenderUserId: DEFENDER_USER_ID,
        defenderSnapshotId: DEFENDER_SNAPSHOT_ID,
        challengerSourceRevision: 12,
        matchSeed: expect.stringContaining("challenge-001"),
        challengerWon: expect.any(Boolean),
      }),
    );

    expect(store.committed[0]?.result).toEqual(
      expect.objectContaining({ challengerSchoolName: "青葉高校" }),
    );

    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        operationId: "challenge-001",
        revision: 12,
        seasonId: "2026-08",
        matchId: "00000000-0000-4000-8000-000000000333",
        opponent: {
          snapshotId: DEFENDER_SNAPSHOT_ID,
          schoolName: "白波高校",
          schoolShortName: "白波",
        },
        rating: {
          before: 1000,
          after: expect.any(Number),
          delta: expect.any(Number),
        },
        result: expect.objectContaining({
          outcome: expect.stringMatching(/^(win|loss)$/),
          challengerSetsWon: expect.any(Number),
          defenderSetsWon: expect.any(Number),
          sets: expect.any(Array),
        }),
      }),
    );
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("abilities");
    expect(serialized).not.toContain("potential");
    expect(serialized).not.toContain("tier");
    expect(serialized).not.toContain("hiddenTraitIds");
    expect(serialized).not.toContain("homeSelection");
    expect(serialized).not.toContain("awaySelection");
    expect(serialized).not.toContain("actorPlayerId");
    expect(serialized).not.toContain("challengerSchoolName");
  });

  it("replays a stored challenge response before loading or simulating anything", async () => {
    const snapshot = createCloudSnapshot();
    const games = gameStore(snapshot);
    const store = pvpStore();
    const replay = {
      operationId: "challenge-replay",
      revision: 12,
      seasonId: "2026-08",
      matchId: "stored-match",
      opponent: {
        snapshotId: DEFENDER_SNAPSHOT_ID,
        schoolName: "白波高校",
        schoolShortName: "白波",
      },
      rating: { before: 1000, after: 1016, delta: 16 },
      result: {
        outcome: "win",
        challengerSetsWon: 2,
        defenderSetsWon: 0,
        sets: [
          { setNumber: 1, challengerScore: 25, defenderScore: 19 },
          { setNumber: 2, challengerScore: 25, defenderScore: 21 },
        ],
      },
      createdAt: "2026-08-28T07:20:00.000Z",
    };
    vi.mocked(store.findChallengeOperation).mockResolvedValue({
      userId: CHALLENGER_USER_ID,
      operationId: "challenge-replay",
      kind: "challenge",
      response: replay,
    });
    const handler = createPvpChallengeHandler({
      gameStore: games,
      pvpStore: store,
    });

    const response = await handler(request(challengeBody("challenge-replay")), {
      id: CHALLENGER_USER_ID,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(replay);
    expect(games.getSnapshot).not.toHaveBeenCalled();
    expect(store.getSnapshotById).not.toHaveBeenCalled();
    expect(store.commitRatedMatch).not.toHaveBeenCalled();
  });

  it("rejects operation ids already used by a different PvP command", async () => {
    const snapshot = createCloudSnapshot();
    const store = pvpStore();
    vi.mocked(store.findChallengeOperation).mockResolvedValue({
      userId: CHALLENGER_USER_ID,
      operationId: "shared-operation",
      kind: "publish",
      response: {},
    });
    const handler = createPvpChallengeHandler({
      gameStore: gameStore(snapshot),
      pvpStore: store,
    });

    const response = await handler(request(challengeBody("shared-operation")), {
      id: CHALLENGER_USER_ID,
    });

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("pvp_operation_conflict");
    expect(store.commitRatedMatch).not.toHaveBeenCalled();
  });

  it("rejects stale revisions, missing or inactive opponents, self matches, and forged fields", async () => {
    const stale = createCloudSnapshot(13);
    const staleStore = pvpStore();
    const staleHandler = createPvpChallengeHandler({
      gameStore: gameStore(stale),
      pvpStore: staleStore,
    });
    const staleResponse = await staleHandler(request(challengeBody()), {
      id: CHALLENGER_USER_ID,
    });
    expect(staleResponse.status).toBe(409);
    expect((await staleResponse.json()).error.code).toBe("revision_conflict");
    expect(staleStore.getSnapshotById).not.toHaveBeenCalled();

    const snapshot = createCloudSnapshot();
    const missingStore = pvpStore(null);
    const missingHandler = createPvpChallengeHandler({
      gameStore: gameStore(snapshot),
      pvpStore: missingStore,
    });
    const missingResponse = await missingHandler(request(challengeBody()), {
      id: CHALLENGER_USER_ID,
    });
    expect(missingResponse.status).toBe(404);
    expect((await missingResponse.json()).error.code).toBe(
      "pvp_opponent_unavailable",
    );

    const inactiveStore = pvpStore(createDefenderSnapshot({ isActive: false }));
    const inactiveHandler = createPvpChallengeHandler({
      gameStore: gameStore(snapshot),
      pvpStore: inactiveStore,
    });
    const inactiveResponse = await inactiveHandler(request(challengeBody()), {
      id: CHALLENGER_USER_ID,
    });
    expect(inactiveResponse.status).toBe(409);
    expect((await inactiveResponse.json()).error.code).toBe(
      "pvp_opponent_inactive",
    );

    const selfStore = pvpStore(
      createDefenderSnapshot({ userId: CHALLENGER_USER_ID }),
    );
    const selfHandler = createPvpChallengeHandler({
      gameStore: gameStore(snapshot),
      pvpStore: selfStore,
    });
    const selfResponse = await selfHandler(request(challengeBody()), {
      id: CHALLENGER_USER_ID,
    });
    expect(selfResponse.status).toBe(400);
    expect((await selfResponse.json()).error.code).toBe("pvp_self_match");

    const forgedStore = pvpStore();
    const forgedHandler = createPvpChallengeHandler({
      gameStore: gameStore(snapshot),
      pvpStore: forgedStore,
    });
    const forgedResponse = await forgedHandler(
      request({
        ...challengeBody(),
        challengerWon: true,
        ratingDelta: 9999,
        matchSeed: "browser-seed",
        abilities: { spike: 100 },
      }),
      { id: CHALLENGER_USER_ID },
    );
    expect(forgedResponse.status).toBe(400);
    expect((await forgedResponse.json()).error.code).toBe(
      "invalid_pvp_challenge_request",
    );
    expect(forgedStore.getSnapshotById).not.toHaveBeenCalled();
    expect(forgedStore.commitRatedMatch).not.toHaveBeenCalled();
  });

  it("returns the DB-enforced daily opponent limit without a separate rating write", async () => {
    const snapshot = createCloudSnapshot();
    const store = pvpStore();
    vi.mocked(store.commitRatedMatch).mockRejectedValue(
      new Error("pvp_daily_opponent_limit"),
    );
    const handler = createPvpChallengeHandler({
      gameStore: gameStore(snapshot),
      pvpStore: store,
      now: () => new Date("2026-08-28T07:30:00.000Z"),
    });

    const response = await handler(request(challengeBody("challenge-fourth")), {
      id: CHALLENGER_USER_ID,
    });

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("pvp_daily_opponent_limit");
    expect(store.commitRatedMatch).toHaveBeenCalledTimes(1);
    expect(store.listRanking).not.toHaveBeenCalled();
    expect(store.listHistory).not.toHaveBeenCalled();
  });

  it("uses the canonical atomic-store result when concurrent duplicate requests race", async () => {
    const snapshot = createCloudSnapshot();
    const store = pvpStore();
    vi.mocked(store.commitRatedMatch).mockImplementation(async (input) => ({
      ...committedMatch(input),
      result: {
        outcome: "loss",
        challengerSetsWon: 0,
        defenderSetsWon: 2,
        sets: [
          { setNumber: 1, challengerScore: 20, defenderScore: 25 },
          { setNumber: 2, challengerScore: 22, defenderScore: 25 },
        ],
      },
      winnerUserId: DEFENDER_USER_ID,
      challengerRatingBefore: 1000,
      challengerRatingAfter: 984,
      defenderRatingBefore: 1000,
      defenderRatingAfter: 1016,
    }));
    const handler = createPvpChallengeHandler({
      gameStore: gameStore(snapshot),
      pvpStore: store,
    });

    const response = await handler(request(challengeBody("challenge-race")), {
      id: CHALLENGER_USER_ID,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.outcome).toBe("loss");
    expect(body.rating).toEqual({ before: 1000, after: 984, delta: -16 });
  });
});
