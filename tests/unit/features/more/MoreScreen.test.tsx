import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MoreScreen } from "../../../../src/features/more/MoreScreen";

describe("MoreScreen", () => {
  it("exposes real school management and logout actions without fake live-service buttons", () => {
    const onOpenSchool = vi.fn();
    const onSignOut = vi.fn();

    render(
      <MoreScreen
        accountLabel="coach@example.com"
        onOpenSchool={onOpenSchool}
        onSignOut={onSignOut}
      />,
    );

    expect(screen.getByRole("heading", { name: "その他" })).toBeVisible();
    expect(screen.getByText("coach@example.com")).toBeVisible();
    expect(screen.getByRole("button", { name: "学校管理" })).toBeVisible();
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "PvP" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "ショップ" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "学校管理" }));
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    expect(onOpenSchool).toHaveBeenCalledTimes(1);
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
