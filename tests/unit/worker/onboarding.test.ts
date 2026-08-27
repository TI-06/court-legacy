import { describe, expect, it, vi } from "vitest";
import type {
  CloudGameSnapshot,
  CreateCloudGameInput,
  GameStore,
} from "../../../worker/data/GameStore";
import { GameAlreadyExistsError } from "../../../worker/data/GameStore";
import { createOnboardingHandler } from "../../../worker/routes/onboarding";

function onboardingRequest(body: unknown): Request {
  return new Request("https://court-legacy.test/api/onboarding", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createStore(
  createGameImpl?: (input: CreateCloudGameInput) => Promise<CloudGameSnapshot>,
): GameStore {
  return {
    getSnapshot: vi.fn(async () => null),
    getOperationResponse: vi.fn(async () => null),
    createGame: vi.fn(
      createGameImpl ??
        (async (input) => ({
          userId: input.userId,
          schoolDbId: "00000000-0000-4000-8000-000000000001",
          revision: 1,
          state: input.state,
          teamSelection: input.teamSelection,
        })),
    ),
    applyOperation: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

const validInput = {
  displayName: "  TI監督  ",
  schoolName: "  青葉高校  ",
  schoolShortName: "  青葉  ",
  coachName: "  高橋 監督  ",
  regionId: "region.chiba",
};

describe("onboarding route", () => {
  it("trims names, creates a deterministic initial world, and persists it atomically", async () => {
    const store = createStore();
    const handler = createOnboardingHandler({
      store,
      createCreationNonce: () => "creation-001",
    });

    const response = await handler(onboardingRequest(validInput), {
      id: "user-123",
    });

    expect(response.status).toBe(201);
    expect(store.createGame).toHaveBeenCalledTimes(1);
    const [input] = vi.mocked(store.createGame).mock.calls[0]!;
    expect(input.displayName).toBe("TI監督");
    expect(input.schoolName).toBe("青葉高校");
    expect(input.schoolShortName).toBe("青葉");
    expect(input.coachName).toBe("高橋 監督");
    expect(input.regionId).toBe("region.chiba");
    expect(input.state.seed).toBe("user-123:creation-001");
    expect(input.state.schools[input.state.userSchoolId]?.name).toBe("青葉高校");
    expect(input.teamSelection.rotation).toHaveLength(6);
    expect(input.teamSelection.liberoPlayerId).not.toBeNull();

    const body = await response.json();
    expect(body.status).toBe("ready");
    expect(body.game.revision).toBe(1);
  });

  it("rejects an unknown region before touching persistence", async () => {
    const store = createStore();
    const handler = createOnboardingHandler({
      store,
      createCreationNonce: () => "creation-001",
    });

    const response = await handler(
      onboardingRequest({ ...validInput, regionId: "region.mars" }),
      { id: "user-123" },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_onboarding",
        message: "学校設定を確認してください",
      },
    });
    expect(store.createGame).not.toHaveBeenCalled();
  });

  it("rejects blank trimmed names", async () => {
    const store = createStore();
    const handler = createOnboardingHandler({
      store,
      createCreationNonce: () => "creation-001",
    });

    const response = await handler(
      onboardingRequest({ ...validInput, schoolName: "   " }),
      { id: "user-123" },
    );

    expect(response.status).toBe(400);
    expect(store.createGame).not.toHaveBeenCalled();
  });

  it("maps duplicate onboarding to a structured 409", async () => {
    const store = createStore(async () => {
      throw new GameAlreadyExistsError();
    });
    const handler = createOnboardingHandler({
      store,
      createCreationNonce: () => "creation-001",
    });

    const response = await handler(onboardingRequest(validInput), {
      id: "user-123",
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "game_already_exists",
        message: "すでに学校データが作成されています",
      },
    });
  });
});
