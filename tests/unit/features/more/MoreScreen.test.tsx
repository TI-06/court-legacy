import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MoreScreen } from "../../../../src/features/more/MoreScreen";

describe("MoreScreen", () => {
  it("shows shop and inventory as peer actions", () => {
    const onOpenShop = vi.fn();
    const onOpenInventory = vi.fn();
    const onResetGameData = vi.fn().mockResolvedValue(undefined);
    const onSignOut = vi.fn();

    render(
      <MoreScreen
        accountLabel="coach@example.com"
        onOpenInventory={onOpenInventory}
        onOpenShop={onOpenShop}
        onResetGameData={onResetGameData}
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
    expect(screen.getByText("ゲームデータを完全初期化")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "ショップ" }));
    fireEvent.click(screen.getByRole("button", { name: "所持品" }));
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    expect(onOpenShop).toHaveBeenCalledTimes(1);
    expect(onOpenInventory).toHaveBeenCalledTimes(1);
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation before completely resetting game data", async () => {
    const onResetGameData = vi.fn().mockResolvedValue(undefined);

    render(
      <MoreScreen
        accountLabel="coach@example.com"
        onOpenInventory={vi.fn()}
        onOpenShop={vi.fn()}
        onResetGameData={onResetGameData}
        onSignOut={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "初期化する" }));
    expect(
      screen.getByText("この操作は元に戻せません。本当に初期化しますか？"),
    ).toBeVisible();
    expect(onResetGameData).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "完全に初期化する" }));

    expect(onResetGameData).toHaveBeenCalledTimes(1);
  });
});
