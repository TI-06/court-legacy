import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import App from "../../src/App";
import type {
  AuthClient,
  AuthSession,
} from "../../src/services/auth/AuthClient";
import type { GameApiClient } from "../../src/services/api/GameApiClient";

function authClient(): AuthClient {
  return {
    getSession: vi.fn(() => new Promise<AuthSession | null>(() => undefined)),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signInWithEmail: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

function apiClient(): GameApiClient {
  return {
    bootstrap: vi.fn(),
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
});
