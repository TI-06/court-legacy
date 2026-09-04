import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { AuthClient } from "../../../../src/services/auth/AuthClient";
import { LoginScreen } from "../../../../src/features/auth/LoginScreen";

function authClient(overrides: Record<string, unknown> = {}): AuthClient {
  return {
    getSession: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    signInWithCredentials: vi.fn().mockResolvedValue(undefined),
    registerAccount: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    isPasswordRecovery: vi.fn().mockReturnValue(false),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AuthClient;
}

describe("LoginScreen", () => {
  it("uses login ID and password without Google login", () => {
    render(<LoginScreen authClient={authClient()} />);

    expect(screen.queryByText(/Google/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("ログインID")).toBeVisible();
    expect(screen.getByLabelText("パスワード")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "ログインする" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "新規登録はこちら" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "パスワードを忘れた方" }),
    ).toBeVisible();
  });

  it("normalizes login ID and signs in with the password", async () => {
    const signInWithCredentials = vi.fn().mockResolvedValue(undefined);
    render(
      <LoginScreen authClient={authClient({ signInWithCredentials })} />,
    );

    fireEvent.change(screen.getByLabelText("ログインID"), {
      target: { value: "  Coach.TAKU  " },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログインする" }));

    expect(signInWithCredentials).toHaveBeenCalledWith(
      "coach.taku",
      "password123",
    );
  });

  it("shows all required account registration fields", () => {
    render(<LoginScreen authClient={authClient()} />);

    fireEvent.click(screen.getByRole("button", { name: "新規登録はこちら" }));

    expect(screen.getByLabelText("メールアドレス")).toBeVisible();
    expect(screen.getByLabelText("ログインID")).toBeVisible();
    expect(screen.getByLabelText("パスワード")).toBeVisible();
    expect(screen.getByLabelText("パスワード確認")).toBeVisible();
    expect(screen.getByLabelText("監督名")).toBeVisible();
    expect(screen.getByLabelText("高校名")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "この内容で登録" }),
    ).toBeVisible();
  });

  it("does not submit registration when password confirmation differs", async () => {
    const registerAccount = vi.fn().mockResolvedValue(undefined);
    render(<LoginScreen authClient={authClient({ registerAccount })} />);

    fireEvent.click(screen.getByRole("button", { name: "新規登録はこちら" }));
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "coach@example.com" },
    });
    fireEvent.change(screen.getByLabelText("ログインID"), {
      target: { value: "coach.taku" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("パスワード確認"), {
      target: { value: "password456" },
    });
    fireEvent.change(screen.getByLabelText("監督名"), {
      target: { value: "田中監督" },
    });
    fireEvent.change(screen.getByLabelText("高校名"), {
      target: { value: "千葉第一高校" },
    });
    fireEvent.click(screen.getByRole("button", { name: "この内容で登録" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "パスワードが一致しません",
    );
    expect(registerAccount).not.toHaveBeenCalled();
  });

  it("requests a password reset email from the forgot-password view", async () => {
    const requestPasswordReset = vi.fn().mockResolvedValue(undefined);
    render(<LoginScreen authClient={authClient({ requestPasswordReset })} />);

    fireEvent.click(
      screen.getByRole("button", { name: "パスワードを忘れた方" }),
    );
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "  Coach@Example.COM  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "再設定メールを送信" }),
    );

    expect(requestPasswordReset).toHaveBeenCalledWith("coach@example.com");
    expect(
      await screen.findByText("パスワード再設定メールを送信しました"),
    ).toBeVisible();
  });
});
