import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type {
  AuthGateway,
  AuthSession,
} from "../../../src/auth/AuthGateway";
import { AuthGate } from "../../../src/auth/AuthGate";

const session: AuthSession = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: 2_000_000_000,
  user: {
    id: "user-1",
    email: "coach@example.com",
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function gateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    restoreSession: vi.fn().mockResolvedValue(null),
    signInWithPassword: vi.fn().mockResolvedValue(session),
    signUpWithPassword: vi.fn().mockResolvedValue({ session }),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("AuthGate", () => {
  it("always shows a visible status while restoring the session", async () => {
    const pending = deferred<AuthSession | null>();
    const auth = gateway({ restoreSession: vi.fn(() => pending.promise) });

    render(
      <AuthGate gateway={auth}>
        {() => <div>GAME</div>}
      </AuthGate>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "ログイン状態を確認中",
    );
    expect(screen.queryByText("GAME")).not.toBeInTheDocument();

    pending.resolve(null);
    expect(await screen.findByRole("heading", { name: "ログイン" })).toBeVisible();
  });

  it("requires authentication before rendering the game", async () => {
    const auth = gateway();

    render(
      <AuthGate gateway={auth}>
        {() => <div>GAME</div>}
      </AuthGate>,
    );

    expect(await screen.findByRole("heading", { name: "ログイン" })).toBeVisible();
    expect(screen.queryByText("GAME")).not.toBeInTheDocument();
  });

  it("shows progress during sign in and renders the game after success", async () => {
    const pending = deferred<AuthSession>();
    const signInWithPassword = vi.fn(() => pending.promise);
    const auth = gateway({ signInWithPassword });

    render(
      <AuthGate gateway={auth}>
        {({ user }) => <div>GAME {user.email}</div>}
      </AuthGate>,
    );

    await screen.findByRole("heading", { name: "ログイン" });
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "coach@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログインする" }));

    expect(screen.getByRole("status")).toHaveTextContent("ログイン中");
    expect(screen.getByRole("button", { name: "ログイン中" })).toBeDisabled();

    pending.resolve(session);
    expect(await screen.findByText("GAME coach@example.com")).toBeVisible();
    expect(signInWithPassword).toHaveBeenCalledWith(
      "coach@example.com",
      "password123",
    );
  });

  it("shows a recoverable error instead of an ambiguous blank state", async () => {
    const auth = gateway({
      signInWithPassword: vi.fn().mockRejectedValue(new Error("invalid login")),
    });

    render(
      <AuthGate gateway={auth}>
        {() => <div>GAME</div>}
      </AuthGate>,
    );

    await screen.findByRole("heading", { name: "ログイン" });
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "coach@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログインする" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ログインできませんでした",
    );
    expect(screen.getByRole("button", { name: "ログインする" })).toBeEnabled();
  });
});
