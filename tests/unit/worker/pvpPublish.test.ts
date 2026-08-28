import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type {
  CloudGameSnapshot,
  GameStore,
} from "../../../worker/data/GameStore";
import type {
  PublishPvpSnapshotInput,
  PvPStore,
} from "../../../worker/data/PvPStore";
import { createPvpPublishHandler } from "../../../worker/routes/pvpPublish";

function createSnapshot(revision = 9): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "pvp-publish-fixture",
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
  const school = state.schools[state.userSchoolId]!;
  const firstPlayer = state.players[school.playerIds[0]!]!;
  firstPlayer.condition = 41;
  firstPlayer.fatigue = 77;
  firstPlayer.injury = {
    injuryId: "fixture-injury",
    severity: "minor",
    remainingWeeks: 2,
    recurrenceRisk: 15,
  };

  return {
    userId: "00000000-0000-0000-0000-000000000001",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
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

function pvpStore(): PvPStore & {
  published: PublishPvpSnapshotInput[];
} {
  const store: PvPStore & { published: PublishPvpSnapshotInput[] } = {
    published: [],
    publishSnapshot: vi.fn(async (input) => {
      store.published.push(input);
      return {
        id: "snapshot-published",
        userId: input.userId,
        sourceRevision: input.sourceRevision,
        sourceAcademicYear: input.sourceAcademicYear,
        sourceYearIndex: input.sourceYearIndex,
        school: input.school,
        players: input.players,
        teamSelection: input.teamSelection,
        isActive: true,
        publishedAt: "2026-08-28T06:30:00.000Z",
      };
    }),
    findChallengeOperation: vi.fn(async () => null),
    getSnapshotById: vi.fn(async () => null),
    commitRatedMatch: vi.fn(async () => {
      throw new Error("not used");
    }),
    listOpponents: vi.fn(async () => []),
    listRanking: vi.fn(async () => []),
    listHistory: vi.fn(async () => []),
  };
  return store;
}

function request(body: unknown): Request {
  return new Request("https://court-legacy.test/api/pvp/team/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PvP publish route", () => {
  it("publishes a normalized frozen team and returns only a public summary", async () => {
    const snapshot = createSnapshot();
    const store = pvpStore();
    const handler = createPvpPublishHandler({
      gameStore: gameStore(snapshot),
      pvpStore: store,
    });

    const response = await handler(
      request({ operationId: "publish-001", revision: 9 }),
      { id: snapshot.userId },
    );

    expect(response.status).toBe(200);
    expect(store.published).toHaveLength(1);
    const published = store.published[0]!;
    const originalSchool = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const originalPlayer = snapshot.state.players[originalSchool.playerIds[0]!]!;
    const frozenPlayer = published.players[originalPlayer.id]!;

    expect(published.school).not.toBe(originalSchool);
    expect(frozenPlayer).not.toBe(originalPlayer);
    expect(frozenPlayer.condition).toBe(100);
    expect(frozenPlayer.fatigue).toBe(0);
    expect(frozenPlayer.injury).toBeNull();
    expect(originalPlayer.condition).toBe(41);
    expect(originalPlayer.fatigue).toBe(77);
    expect(originalPlayer.injury).not.toBeNull();

    const body = await response.json();
    expect(body).toEqual({
      operationId: "publish-001",
      revision: 9,
      team: expect.objectContaining({
        snapshotId: "snapshot-published",
        schoolName: "青葉高校",
        schoolShortName: "青葉",
        academicYear: snapshot.state.calendar.academicYear,
        publishedAt: "2026-08-28T06:30:00.000Z",
      }),
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("abilities");
    expect(serialized).not.toContain("tier");
    expect(serialized).not.toContain("hiddenTraitIds");
    expect(serialized).not.toContain(originalPlayer.id);
  });

  it("rejects stale revisions before publishing", async () => {
    const snapshot = createSnapshot(10);
    const store = pvpStore();
    const handler = createPvpPublishHandler({
      gameStore: gameStore(snapshot),
      pvpStore: store,
    });

    const response = await handler(
      request({ operationId: "publish-002", revision: 9 }),
      { id: snapshot.userId },
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("revision_conflict");
    expect(store.publishSnapshot).not.toHaveBeenCalled();
  });

  it("rejects forged team truth and other extra request fields", async () => {
    const snapshot = createSnapshot();
    const store = pvpStore();
    const handler = createPvpPublishHandler({
      gameStore: gameStore(snapshot),
      pvpStore: store,
    });

    const response = await handler(
      request({
        operationId: "publish-003",
        revision: 9,
        rating: 9999,
        abilities: { spike: 100 },
      }),
      { id: snapshot.userId },
    );

    expect(response.status).toBe(400);
    expect(store.publishSnapshot).not.toHaveBeenCalled();
  });

  it("passes the same operation id to the atomic store for replay safety", async () => {
    const snapshot = createSnapshot();
    const store = pvpStore();
    const handler = createPvpPublishHandler({
      gameStore: gameStore(snapshot),
      pvpStore: store,
    });

    const first = await handler(
      request({ operationId: "publish-replay", revision: 9 }),
      { id: snapshot.userId },
    );
    const second = await handler(
      request({ operationId: "publish-replay", revision: 9 }),
      { id: snapshot.userId },
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(store.publishSnapshot).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ operationId: "publish-replay" }),
    );
    expect(store.publishSnapshot).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ operationId: "publish-replay" }),
    );
  });
});