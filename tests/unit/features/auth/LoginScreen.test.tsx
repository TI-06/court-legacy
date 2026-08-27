import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { AuthClient } from "../../../../src/services/auth/AuthClient";
import { LoginScreen } from "../../../../src/features/auth/LoginScreen";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function authClient(overrides: Partial<AuthClient> = {}): AuthClient {
  return {
    getSession: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signInWithEmail: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("LoginScreen", () => {
  it("shows both Google and email login choices", () => {
    render(<LoginScreen authClient={authClient()} />);

    expect(
      screen.getByRole("button", { name: "Googleで始める" }),
    ).toBeVisible();
    expect(screen.getByLabelText("メールアドレス")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "メールでログイン" }),
    ).toBeVisible();
  });

  it("shows Google progress immediately without disabling email login", async () => {
    const pending = deferred<void>();
    const signInWithGoogle = vi.fn(() => pending.promise);
    render(
      <LoginScreen authClient={authClient({ signInWithGoogle })} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Googleで始める" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Googleログインを開始中",
    );
    expect(
      screen.getByRole("button", { name: "Googleログインを開始中" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "メールでログイン" }),
    ).toBeEnabled();

    pending.resolve();
  });

  it("normalizes email and shows a sent-message after magic-link request", async () => {
    const pending = deferred<void>();
    const signInWithEmail = vi.fn(() => pending.promise);
    render(<LoginScreen authClient={authClient({ signInWithEmail })} />);

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "  Coach@Example.COM  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "メールでログイン" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "ログイン用メールを送信中",
    );
    expect(
      screen.getByRole("button", { name: "メールを送信中" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Googleで始める" }),
    ).toBeEnabled();

    pending.resolve();

    expect(
      await screen.findByText("ログイン用メールを送信しました"),
    ).toBeVisible();
    expect(signInWithEmail).toHaveBeenCalledWith("coach@example.com");
  });

  it("keeps errors visible and leaves the failed method retryable", async () => {
    const signInWithEmail = vi.fn().mockRejectedValue(new Error("network"));
    render(<LoginScreen authClient={authClient({ signInWithEmail })} />);

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "coach@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "メールでログイン" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ログイン用メールを送信できませんでした",
    );
    expect(
      screen.getByRole("button", { name: "メールでログイン" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Googleで始める" }),
    ).toBeEnabled();
  });
});
