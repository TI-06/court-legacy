import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { PasswordResetScreen } from "../../../../src/features/auth/PasswordResetScreen";
import type { AuthClient } from "../../../../src/services/auth/AuthClient";

function authClient(updatePassword = vi.fn().mockResolvedValue(undefined)) {
  return {
    getSession: vi.fn(),
    subscribe: vi.fn(),
    signInWithCredentials: vi.fn(),
    registerAccount: vi.fn(),
    requestPasswordReset: vi.fn(),
    updatePassword,
    isPasswordRecovery: vi.fn().mockReturnValue(true),
    signOut: vi.fn(),
  } as unknown as AuthClient;
}

describe("PasswordResetScreen", () => {
  it("requires matching passwords and updates the recovery session password", async () => {
    const updatePassword = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn();
    render(
      <PasswordResetScreen
        authClient={authClient(updatePassword)}
        onComplete={onComplete}
      />,
    );

    fireEvent.change(
      screen.getByLabelText("新しいパスワード", { selector: "input" }),
      {
        target: { value: "new-password-123" },
      },
    );
    fireEvent.change(screen.getByLabelText("パスワード確認"), {
      target: { value: "new-password-123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "新しいパスワードを設定" }),
    );

    expect(updatePassword).toHaveBeenCalledWith("new-password-123");
    expect(
      await screen.findByRole("button", { name: "変更中…" }),
    ).toBeDisabled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not submit mismatched passwords", async () => {
    const updatePassword = vi.fn().mockResolvedValue(undefined);
    render(
      <PasswordResetScreen
        authClient={authClient(updatePassword)}
        onComplete={vi.fn()}
      />,
    );

    fireEvent.change(
      screen.getByLabelText("新しいパスワード", { selector: "input" }),
      {
        target: { value: "new-password-123" },
      },
    );
    fireEvent.change(screen.getByLabelText("パスワード確認"), {
      target: { value: "different-password" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "新しいパスワードを設定" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "パスワードが一致しません",
    );
    expect(updatePassword).not.toHaveBeenCalled();
  });
});
