import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type {
  PvpChallengeRequest,
  PvpListRequestQuery,
  PvpPublishRequest,
} from "../../../src/domain/pvp/pvpContracts";
import {
  ApiError,
  HttpGameApiClient,
} from "../../../src/services/api/GameApiClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("HttpGameApiClient PvP", () => {
  it("publishes only operation metadata and forwards auth plus AbortSignal", async () => {
    const response = {
      operationId: "publish-1",
      revision: 9,
      team: {
        snapshotId: "00000000-0000-4000-8000-000000000101",
        schoolName: "青葉高校",
        schoolShortName: "青葉",
        reputationRank: "B",
        teamPower: 71,
        academicYear: 2026,
        publishedAt: "2026-08-28T07:00:00.000Z",
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(response));
    const api = new HttpGameApiClient(fetchImpl);
    const controller = new AbortController();
    const request: PvpPublishRequest = {
      operationId: "publish-1",
      revision: 9,
    };

    await expect(
      api.publishPvpTeam("access-token", request, controller.signal),
    ).resolves.toEqual(response);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/pvp/team/publish",
      expect.objectContaining({
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify(request),
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
          "content-type": "application/json",
        }),
      }),
    );
  });

  it("encodes opponent paging without allowing a browser season override", async () => {
    const response = {
      seasonId: "2026-08",
      opponents: [],
      nextCursor: null,
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(response));
    const api = new HttpGameApiClient(fetchImpl);
    const query: PvpListRequestQuery = {
      cursor: "snapshot/next?token=1",
      limit: 30,
    };

    await expect(api.getPvpOpponents("access-token", query)).resolves.toEqual(
      response,
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/pvp/opponents?cursor=snapshot%2Fnext%3Ftoken%3D1&limit=30",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("challenges with only operation id, revision, and opponent snapshot id", async () => {
    const response = {
      operationId: "challenge-1",
      revision: 9,
      seasonId: "2026-08",
      matchId: "00000000-0000-4000-8000-000000000301",
      opponent: {
        snapshotId: "00000000-0000-4000-8000-000000000201",
        schoolName: "白波高校",
        schoolShortName: "白波",
      },
      rating: { before: 1000, after: 1016, delta: 16 },
      result: {
        outcome: "win",
        challengerSetsWon: 2,
        defenderSetsWon: 1,
        sets: [
          { setNumber: 1, challengerScore: 25, defenderScore: 20 },
          { setNumber: 2, challengerScore: 22, defenderScore: 25 },
          { setNumber: 3, challengerScore: 25, defenderScore: 18 },
        ],
      },
      createdAt: "2026-08-28T07:10:00.000Z",
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(response));
    const api = new HttpGameApiClient(fetchImpl);
    const request: PvpChallengeRequest = {
      operationId: "challenge-1",
      revision: 9,
      opponentSnapshotId: "00000000-0000-4000-8000-000000000201",
    };

    await expect(
      api.challengePvpTeam("access-token", request),
    ).resolves.toEqual(response);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/pvp/challenge",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
  });

  it("loads ranking and history using encoded current-page cursors", async () => {
    const rankingResponse = {
      seasonId: "2026-08",
      ranking: [],
      nextCursor: null,
    };
    const historyResponse = {
      seasonId: "2026-08",
      history: [],
      nextCursor: null,
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(rankingResponse))
      .mockResolvedValueOnce(jsonResponse(historyResponse));
    const api = new HttpGameApiClient(fetchImpl);

    await expect(
      api.getPvpRanking("access-token", { cursor: "20", limit: 20 }),
    ).resolves.toEqual(rankingResponse);
    await expect(
      api.getPvpHistory("access-token", {
        cursor: "2026-08-28T07:10:00.000Z|00000000-0000-4000-8000-000000000301",
        limit: 10,
      }),
    ).resolves.toEqual(historyResponse);

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/pvp/ranking?cursor=20&limit=20",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "/api/pvp/history?cursor=2026-08-28T07%3A10%3A00.000Z%7C00000000-0000-4000-8000-000000000301&limit=10",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("maps structured PvP API failures through the shared ApiError boundary", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "pvp_daily_opponent_limit",
            message: "同じ相手とのレーティング対戦は1日3回までです",
          },
        },
        409,
      ),
    );
    const api = new HttpGameApiClient(fetchImpl);

    const error = await api
      .challengePvpTeam("access-token", {
        operationId: "challenge-fourth",
        revision: 9,
        opponentSnapshotId: "00000000-0000-4000-8000-000000000201",
      })
      .catch((reason) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "pvp_daily_opponent_limit",
      message: "同じ相手とのレーティング対戦は1日3回までです",
    });
  });

  it("keeps browser PvP contracts free of server-only snapshot and store imports", () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), "src/services/api/GameApiClient.ts"),
      "utf8",
    );
    const contractSource = readFileSync(
      resolve(process.cwd(), "src/domain/pvp/pvpContracts.ts"),
      "utf8",
    );
    const browserPvpSource = `${clientSource}\n${contractSource}`;

    for (const forbidden of [
      "worker/data/PvPStore",
      "worker/data/SupabasePvPStore",
      "worker/pvp/",
      "PublishedPvpTeamSnapshot",
      "Player[",
      "abilities",
      "hiddenTraitIds",
      "potential",
    ]) {
      expect(browserPvpSource).not.toContain(forbidden);
    }
  });
});
