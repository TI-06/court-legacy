import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import App from "../../src/App";
import { createDemoGame } from "../../src/app/createDemoGame";
import { autoSelectTeam } from "../../src/domain/team/autoSelectTeam";
import type { GameApiClient } from "../../src/services/api/GameApiClient";
import type {
  AuthClient,
  AuthSession,
} from "../../src/services/auth/AuthClient";
import type { CloudGameSnapshot } from "../../worker/data/GameStore";

const readySession: AuthSession = {
  userId: "user-1",
  email: "coach@example.com",
  accessToken: "token-1",
};

function createSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: readySession.userId,
    schoolDbId: "school-db-1",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    }),
  };
}

function authClient(
  session: AuthSession | null | "pending" = "pending",
): AuthClient {
  return {
    getSession: vi.fn(() =>
      session === "pending"
        ? new Promise<AuthSession | null>(() => undefined)
        : Promise.resolve(session),
    ),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signInWithEmail: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

function apiClient(snapshot?: CloudGameSnapshot): GameApiClient {
  return {
    bootstrap: vi.fn().mockResolvedValue(
      snapshot
        ? {
            status: "ready",
            game: snapshot,
          }
        : { status: "needs-onboarding" },
    ),
    onboard: vi.fn(),
    applyAction: vi.fn(),
  };
}

describe("application composition", () => {
  it("starts with an explicit authentication check instead of a demo game", () => {
    render(<App auth={authClient()} api={apiClient()} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "アカウントを確認しています…",
    );
    expect(
      screen.queryByRole("navigation", { name: "主要メニュー" }),
    ).not.toBeInTheDocument();
  });

  it("passes authenticated dependencies into the ready V2 game shell", async () => {
    const snapshot = createSnapshot();

    render(<App auth={authClient(readySession)} api={apiClient(snapshot)} />);

    expect(
      await screen.findByRole("navigation", { name: "主要メニュー" }),
    ).toBeVisible();
    expect(
      screen.getByText(snapshot.state.schools[snapshot.state.userSchoolId]!.name),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("保存済み ✓");
  });
});
