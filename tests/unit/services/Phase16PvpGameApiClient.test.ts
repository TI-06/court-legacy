import { describe, expect, it, vi } from "vitest";
import { HttpGameApiClient } from "../../../src/services/api/GameApiClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function selection() {
  return {
    rotation: [
      { slot: 1 as const, playerId: "player-1" },
      { slot: 2 as const, playerId: "player-2" },
      { slot: 3 as const, playerId: "player-3" },
      { slot: 4 as const, playerId: "player-4" },
      { slot: 5 as const, playerId: "player-5" },
      { slot: 6 as const, playerId: "player-6" },
    ],
    liberoPlayerId: null,
    benchPlayerIds: ["player-7"],
    servingOrderPlayerIds: [
      "player-1",
      "player-2",
      "player-3",
      "player-4",
      "player-5",
      "player-6",
    ],
    substitutionPolicy: {
      starterLockPlayerIds: [],
      allowFatigueBenching: false,
      allowInjuryBenching: true,
      automaticSubstitutions: true,
      automaticSetChanges: false,
    },
  };
}

function inProgressResponse() {
  return {
    status: "in-progress" as const,
    operationId: "challenge/phase16",
    revision: 9,
    seasonId: "2026-09",
    opponent: {
      snapshotId: "00000000-0000-4000-8000-000000000201",
      schoolName: "白波高校",
      schoolShortName: "白波",
    },
    segment: {
      status: "in-progress" as const,
      operationId: "challenge/phase16",
      matchId: "pvp-match-1",
      phase: "coach-decision" as const,
      currentSetNumber: 1,
      challengerSetsWon: 0,
      defenderSetsWon: 0,
      currentScore: { challenger: 8, defender: 12 },
      challengerSelection: selection(),
      challengerTactics: {
        serve: "balanced" as const,
        attack: "balanced" as const,
        block: "read" as const,
      },
      timeoutAvailable: true,
      sets: [],
      pendingDecisionReason: "opponent-run" as const,
      events: [
        {
          sequence: 1,
          type: "point" as const,
          setNumber: 1,
          challengerScore: 8,
          defenderScore: 12,
          winner: "defender" as const,
          detailCode: "point.attack",
        },
      ],
    },
  };
}

describe("Phase16 PvP GameApiClient", () => {
  it("loads a resumable session and posts commands without exposing private state", async () => {
    const start = inProgressResponse();
    const next = {
      ...start,
      segment: {
        ...start.segment,
        currentScore: { challenger: 9, defender: 12 },
      },
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(start))
      .mockResolvedValueOnce(jsonResponse(start))
      .mockResolvedValueOnce(jsonResponse(next));
    const api = new HttpGameApiClient(fetchImpl);

    await expect(
      api.challengePvpTeam("access-token", {
        operationId: "challenge/phase16",
        revision: 9,
        opponentSnapshotId: "00000000-0000-4000-8000-000000000201",
      }),
    ).resolves.toEqual(start);
    await expect(
      api.getPvpChallengeSession("access-token", "challenge/phase16"),
    ).resolves.toEqual(start);
    await expect(
      api.commandPvpChallenge("access-token", {
        operationId: "challenge/phase16",
        commandId: "command-1",
        command: { type: "continue" },
      }),
    ).resolves.toEqual(next);

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "/api/pvp/challenge/session?operationId=challenge%2Fphase16",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "/api/pvp/challenge/command",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          operationId: "challenge/phase16",
          commandId: "command-1",
          command: { type: "continue" },
        }),
      }),
    );
  });

  it("rejects malformed resumable session responses at the browser boundary", async () => {
    const malformed = {
      ...inProgressResponse(),
      segment: {
        ...inProgressResponse().segment,
        challengerSelection: undefined,
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(malformed));
    const api = new HttpGameApiClient(fetchImpl);

    await expect(
      api.getPvpChallengeSession("access-token", "challenge-1"),
    ).rejects.toMatchObject({ code: "invalid_pvp_response" });
  });
});
