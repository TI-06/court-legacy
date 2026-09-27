import { describe, expect, it, vi } from "vitest";
import type { GameStore } from "../../../worker/data/GameStore";
import { createGameResetHandler } from "../../../worker/routes/gameReset";

function store(resetGameData?: (userId: string) => Promise<void>): GameStore {
  return {
    getSnapshot: vi.fn(),
    getOperationResponse: vi.fn(),
    createGame: vi.fn(),
    applyOperation: vi.fn(),
    ...(resetGameData ? { resetGameData } : {}),
  } as unknown as GameStore;
}

describe("game reset route", () => {
  it("deletes only the authenticated user's game data", async () => {
    const resetGameData = vi.fn().mockResolvedValue(undefined);
    const handler = createGameResetHandler(store(resetGameData));

    const response = await handler(
      new Request("https://court-legacy.test/api/game/reset", {
        method: "POST",
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "reset" });
    expect(resetGameData).toHaveBeenCalledWith("user-123");
  });

  it("returns an explicit error when reset storage is unavailable", async () => {
    const handler = createGameResetHandler(store());

    const response = await handler(
      new Request("https://court-legacy.test/api/game/reset", {
        method: "POST",
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(501);
  });
});
