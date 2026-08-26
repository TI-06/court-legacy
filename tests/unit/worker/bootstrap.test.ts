import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type {
  CloudGameSnapshot,
  GameStore,
} from "../../../worker/data/GameStore";
import { createBootstrapHandler } from "../../../worker/routes/bootstrap";

function createSnapshot(userId = "user-123"): CloudGameSnapshot {
  const state = createInitialGame({
    seed: `${userId}:fixture`,
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
    userId,
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision: 3,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function createStore(snapshot: CloudGameSnapshot | null): GameStore {
  return {
    getSnapshot: vi.fn(async () => snapshot),
    createGame: vi.fn(async () => {
      throw new Error("not used");
    }),
    applyOperation: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

describe("bootstrap route", () => {
  it("returns needs-onboarding when the authenticated user has no save", async () => {
    const store = createStore(null);
    const handler = createBootstrapHandler(store);

    const response = await handler(
      new Request("https://court-legacy.test/api/bootstrap"),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "needs-onboarding",
    });
    expect(store.getSnapshot).toHaveBeenCalledWith("user-123");
  });

  it("returns the existing authoritative cloud snapshot", async () => {
    const snapshot = createSnapshot();
    const store = createStore(snapshot);
    const handler = createBootstrapHandler(store);

    const response = await handler(
      new Request("https://court-legacy.test/api/bootstrap"),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ready");
    expect(body.game).toEqual(snapshot);
  });
});
