import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import type { AuthGateway, AuthSession } from "../../../src/auth/AuthGateway";
import { ApplicationRoot } from "../../../src/app/ApplicationRoot";

const session: AuthSession = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: 2_000_000_000,
  user: { id: "user-1", email: "coach@example.com" },
};

function gateway(restored: AuthSession | null): AuthGateway {
  return {
    restoreSession: async () => restored,
    signInWithPassword: async () => session,
    signUpWithPassword: async () => ({ session }),
    signInWithGoogle: () => undefined,
    signOut: async () => undefined,
  };
}

describe("ApplicationRoot", () => {
  it("does not render the game before authentication", async () => {
    render(createElement(ApplicationRoot, { authGateway: gateway(null) }));

    expect(
      await screen.findByRole("heading", { name: "ログイン" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "主要メニュー" }),
    ).not.toBeInTheDocument();
  });

  it("renders the game only after authentication succeeds", async () => {
    render(createElement(ApplicationRoot, { authGateway: gateway(session) }));

    expect(
      await screen.findByRole("navigation", { name: "主要メニュー" }),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "ログイン" })).toBeNull();
  });
});
