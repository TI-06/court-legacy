import { vi } from "vitest";
import { playerId } from "../../../src/domain/model/identifiers";
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

describe("HttpGameApiClient", () => {
  it("sends the bearer token and parses bootstrap JSON", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "needs-onboarding" }));
    const api = new HttpGameApiClient(fetchImpl);

    await expect(api.bootstrap("access-token")).resolves.toEqual({
      status: "needs-onboarding",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/bootstrap",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("posts onboarding JSON and maps a structured 409 error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "game_already_exists",
            message: "すでに学校データが作成されています",
          },
        },
        409,
      ),
    );
    const api = new HttpGameApiClient(fetchImpl);
    const input = {
      displayName: "監督",
      schoolName: "青葉高校",
      schoolShortName: "青葉",
      coachName: "高城 監督",
      regionId: "region.chiba",
    } as const;

    const error = await api
      .onboard("access-token", input)
      .catch((reason) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "game_already_exists",
      message: "すでに学校データが作成されています",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/onboarding",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  });

  it("maps authentication failures to a safe typed error", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { error: { code: "unauthorized", message: "認証が必要です" } },
          401,
        ),
      );
    const api = new HttpGameApiClient(fetchImpl);

    await expect(api.bootstrap("expired-token")).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
      message: "認証が必要です",
    });
  });

  it("maps network failures without leaking the raw error", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error("socket ECONNRESET secret"));
    const api = new HttpGameApiClient(fetchImpl);

    await expect(api.bootstrap("access-token")).rejects.toMatchObject({
      status: null,
      code: "network_error",
      message: "サーバーに接続できませんでした",
    });
  });

  it("passes AbortSignal through to fetch", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "needs-onboarding" }));
    const api = new HttpGameApiClient(fetchImpl);
    const controller = new AbortController();

    await api.bootstrap("access-token", controller.signal);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/bootstrap",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("posts only the server-authoritative action request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        operationId: "op-1",
        game: { revision: 3 },
      }),
    );
    const api = new HttpGameApiClient(fetchImpl);
    const request = {
      operationId: "op-1",
      revision: 2,
      action: { type: "practice-match" as const },
    };

    await api.applyAction("access-token", request);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/game/action",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
  });

  it("posts only operation metadata when loading the scouting board", async () => {
    const response = {
      operationId: "scout-board-1",
      revision: 4,
      cycleKey: "school.user:year-1",
      reports: [],
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(response));
    const api = new HttpGameApiClient(fetchImpl);
    const request = {
      operationId: "scout-board-1",
      revision: 4,
    };

    await expect(
      api.getScoutingBoard("access-token", request),
    ).resolves.toEqual(response);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/scouting/board",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("posts only the candidate id and operation metadata when recruiting", async () => {
    const candidateId = playerId("candidate-1");
    const response = {
      operationId: "recruit-1",
      game: { revision: 5 },
      outcome: {
        candidateId,
        committedCandidateIds: [candidateId],
        cycleKey: "school.user:year-1",
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(response));
    const api = new HttpGameApiClient(fetchImpl);
    const request = {
      operationId: "recruit-1",
      revision: 4,
      candidateId,
    };

    await api.commitRecruit("access-token", request);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/scouting/recruit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
  });
});
