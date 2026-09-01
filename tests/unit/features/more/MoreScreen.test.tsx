import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MoreScreen } from "../../../../src/features/more/MoreScreen";

describe("MoreScreen", () => {
  it("keeps shop and account actions after School moves to the bottom navigation", () => {
    const onOpenShop = vi.fn();
    const onSignOut = vi.fn();

    render(
      <MoreScreen
        accountLabel="coach@example.com"
        onOpenShop={onOpenShop}
        onSignOut={onSignOut}
      />,
    );

    expect(screen.getByRole("heading", { name: "その他" })).toBeVisible();
    expect(screen.getByText("管理メニュー")).toBeVisible();
    expect(screen.getByText("coach@example.com")).toBeVisible();
    expect(screen.queryByRole("button", { name: "学校管理" })).toBeNull();
    expect(screen.getByRole("button", { name: "ショップ" })).toBeVisible();
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "ショップ" }));
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    expect(onOpenShop).toHaveBeenCalledTimes(1);
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
