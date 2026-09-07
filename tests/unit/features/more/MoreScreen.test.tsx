import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MoreScreen } from "../../../../src/features/more/MoreScreen";

describe("MoreScreen", () => {
  it("shows shop and inventory as peer actions", () => {
    const onOpenShop = vi.fn();
    const onOpenInventory = vi.fn();
    const onSignOut = vi.fn();

    render(
      <MoreScreen
        accountLabel="coach@example.com"
        onOpenInventory={onOpenInventory}
        onOpenShop={onOpenShop}
        onSignOut={onSignOut}
      />,
    );

    expect(screen.getByRole("heading", { name: "その他" })).toBeVisible();
    expect(screen.getByText("管理メニュー")).toBeVisible();
    expect(screen.getByText("coach@example.com")).toBeVisible();
    expect(screen.queryByRole("button", { name: "学校管理" })).toBeNull();
    expect(screen.getByRole("button", { name: "ショップ" })).toBeVisible();
    expect(screen.getByRole("button", { name: "所持品" })).toBeVisible();
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "ショップ" }));
    fireEvent.click(screen.getByRole("button", { name: "所持品" }));
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    expect(onOpenShop).toHaveBeenCalledTimes(1);
    expect(onOpenInventory).toHaveBeenCalledTimes(1);
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
