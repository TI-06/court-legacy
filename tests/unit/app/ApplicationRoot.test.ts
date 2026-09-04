import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { vi } from "vitest";
import { ApplicationRoot } from "../../../src/app/ApplicationRoot";
import type {
  AuthClient,
  AuthSession,
} from "../../../src/services/auth/AuthClient";
import type { GameApiClient } from "../../../src/services/api/GameApiClient";

function authClient(): AuthClient {
  return {
    getSession: vi.fn(() => new Promise<AuthSession | null>(() => undefined)),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    signInWithCredentials: vi.fn().mockResolvedValue(undefined),
    registerAccount: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    isPasswordRecovery: vi.fn().mockReturnValue(false),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

function apiClient(): GameApiClient {
  return {
    bootstrap: vi.fn(),
    onboard: vi.fn(),
    applyAction: vi.fn(),
    getScoutingBoard: vi.fn(),
    commitRecruit: vi.fn(),
  };
}

describe("ApplicationRoot", () => {
  it("delegates startup to the cloud-first application without a second auth gate", () => {
    render(
      createElement(ApplicationRoot, {
        auth: authClient(),
        api: apiClient(),
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "アカウントを確認しています…",
    );
    expect(screen.queryByRole("heading", { name: "ログイン" })).toBeNull();
  });
});
