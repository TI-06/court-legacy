import { describe, expect, it, vi } from "vitest";
import type { PvPStore } from "../../../worker/data/PvPStore";
import { createPvpHistoryHandler } from "../../../worker/routes/pvpHistory";
import { createPvpOpponentsHandler } from "../../../worker/routes/pvpOpponents";
import { createPvpRankingHandler } from "../../../worker/routes/pvpRanking";

const userId = "00000000-0000-0000-0000-000000000001";
const now = () => new Date("2026-08-31T15:00:00.000Z");

function pvpStore(): PvPStore {
  return {
    publishSnapshot: vi.fn(async () => {
      throw new Error("not used");
    }),
    findChallengeOperation: vi.fn(async () => null),
    getSnapshotById: vi.fn(async () => null),
    commitRatedMatch: vi.fn(async () => {
      throw new Error("not used");
    }),
    listOpponents: vi.fn(async () => [
      {
        snapshotId: "snapshot-other",
        schoolName: "白峰高校",
        schoolShortName: "白峰",
        reputationRank: "A",
        teamPower: 88,
        academicYear: 2027,
        publishedAt: "2026-08-31T14:00:00.000Z",
        rating: 1048,
        wins: 8,
        losses: 3,
        currentWinStreak: 2,
      },
    ]),
    listRanking: vi.fn(async () => [
      {
        rank: 1,
        snapshotId: "snapshot-other",
        schoolName: "白峰高校",
        schoolShortName: "白峰",
        rating: 1120,
        matches: 20,
        wins: 15,
        losses: 5,
        currentWinStreak: 4,
      },
    ]),
    listHistory: vi.fn(async () => [
      {
        matchId: "match-1",
        createdAt: "2026-08-31T13:00:00.000Z",
        opponentSnapshotId: "snapshot-other",
        opponentSchoolName: "白峰高校",
        outcome: "win" as const,
        ratingBefore: 1000,
        ratingAfter: 1016,
        result: { homeSetsWon: 2, awaySetsWon: 1 },
      },
    ]),
  };
}

function getRequest(path: string): Request {
  return new Request(`https://court-legacy.test${path}`, { method: "GET" });
}

describe("PvP public query routes", () => {
  it("loads opponents for the authenticated user and current JST season", async () => {
    const store = pvpStore();
    const handler = createPvpOpponentsHandler({ pvpStore: store, now });

    const response = await handler(
      getRequest("/api/pvp/opponents?cursor=snapshot-a&limit=12"),
      { id: userId },
    );

    expect(response.status).toBe(200);
    expect(store.listOpponents).toHaveBeenCalledWith({
      userId,
      seasonId: "2026-09",
      cursor: "snapshot-a",
      limit: 12,
    });
    const body = await response.json();
    expect(body.seasonId).toBe("2026-09");
    expect(body.opponents[0]).toEqual(
      expect.objectContaining({
        snapshotId: "snapshot-other",
        schoolName: "白峰高校",
        rating: 1048,
      }),
    );
    expect(JSON.stringify(body)).not.toContain("abilities");
    expect(JSON.stringify(body)).not.toContain("players");
    expect(JSON.stringify(body)).not.toContain("tier");
  });

  it("clamps query limits to 30 and preserves stable cursor tokens", async () => {
    const store = pvpStore();
    const handler = createPvpOpponentsHandler({ pvpStore: store, now });

    const response = await handler(
      getRequest("/api/pvp/opponents?cursor=snapshot-z&limit=999"),
      { id: userId },
    );

    expect(response.status).toBe(200);
    expect(store.listOpponents).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "snapshot-z", limit: 30 }),
    );
  });

  it("loads the current-season ranking without trusting a browser season", async () => {
    const store = pvpStore();
    const handler = createPvpRankingHandler({ pvpStore: store, now });

    const response = await handler(
      getRequest("/api/pvp/ranking?limit=5&seasonId=2099-12"),
      { id: userId },
    );

    expect(response.status).toBe(200);
    expect(store.listRanking).toHaveBeenCalledWith({
      seasonId: "2026-09",
      cursor: null,
      limit: 5,
    });
    const body = await response.json();
    expect(body.seasonId).toBe("2026-09");
    expect(body.ranking[0]).toEqual(
      expect.objectContaining({ rank: 1, rating: 1120 }),
    );
  });

  it("scopes history to the authenticated user and current season", async () => {
    const store = pvpStore();
    const handler = createPvpHistoryHandler({ pvpStore: store, now });

    const response = await handler(
      getRequest("/api/pvp/history?cursor=match-z&limit=7&userId=other"),
      { id: userId },
    );

    expect(response.status).toBe(200);
    expect(store.listHistory).toHaveBeenCalledWith({
      userId,
      seasonId: "2026-09",
      cursor: "match-z",
      limit: 7,
    });
    const body = await response.json();
    expect(body.history[0]).toEqual(
      expect.objectContaining({
        matchId: "match-1",
        opponentSchoolName: "白峰高校",
        outcome: "win",
      }),
    );
    expect(JSON.stringify(body)).not.toContain("abilities");
    expect(JSON.stringify(body)).not.toContain("players");
  });

  it("uses safe defaults for malformed limits", async () => {
    const store = pvpStore();
    const ranking = createPvpRankingHandler({ pvpStore: store, now });

    const response = await ranking(
      getRequest("/api/pvp/ranking?limit=not-a-number"),
      { id: userId },
    );

    expect(response.status).toBe(200);
    expect(store.listRanking).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
    );
  });
});