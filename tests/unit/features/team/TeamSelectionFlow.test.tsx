import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import App from "../../../../src/App";

async function openLineupScreen(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: "選手" }));
  fireEvent.click(screen.getByRole("button", { name: "編成" }));
}

describe("team selection direct-touch UI", () => {
  it("renders a compact 3x2 court, libero, and bench without duplicate starter-lock buttons", async () => {
    render(<App />);
    await openLineupScreen();

    expect(
      screen.getByRole("heading", { name: "チーム編成" }),
    ).toBeInTheDocument();
    expect(screen.getByText("長押しで移動・タップで編集")).toBeVisible();
    expect(screen.getByText("先発6人")).toBeVisible();
    expect(screen.getByText("守備専門")).toBeVisible();
    expect(screen.getByText("控え選手")).toBeVisible();
    expect(screen.getByText("交代ルール")).toBeVisible();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.getAllByTestId("court-player")).toHaveLength(6);
    expect(screen.queryAllByRole("button", { name: /先発固定/ })).toHaveLength(
      0,
    );
    for (let slot = 1; slot <= 6; slot += 1) {
      expect(
        screen.getByRole("button", { name: `ローテーション${slot}を変更` }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: "リベロを変更" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("bench-player")).toHaveLength(5);
  });

  it("opens every school player and starter lock in the slot editor", async () => {
    render(<App />);
    await openLineupScreen();
    fireEvent.click(
      screen.getByRole("button", { name: "ローテーション1を変更" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "ローテーション1の選手を選択",
    });
    expect(within(dialog).getAllByTestId("player-picker-option")).toHaveLength(
      12,
    );
    expect(
      within(dialog).getByRole("button", { name: /先発固定/ }),
    ).toBeVisible();
  });

  it("manually replaces a court player without duplicate active players", async () => {
    render(<App />);
    await openLineupScreen();
    fireEvent.click(
      screen.getByRole("button", { name: "ローテーション1を変更" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "ローテーション1の選手を選択",
    });
    const replacement = within(dialog)
      .getAllByTestId("player-picker-option")
      .find((button) => !button.hasAttribute("disabled"));
    expect(replacement).toBeDefined();

    fireEvent.click(replacement!);

    expect(
      screen.queryByRole("dialog", {
        name: "ローテーション1の選手を選択",
      }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("編成は有効です")).toBeInTheDocument(),
    );
  });

  it("persists starter locks edited inside a slot sheet and safety settings across tab changes", async () => {
    render(<App />);
    await openLineupScreen();

    fireEvent.click(
      screen.getByRole("button", { name: "ローテーション1を変更" }),
    );
    let dialog = screen.getByRole("dialog", {
      name: "ローテーション1の選手を選択",
    });
    const starterLock = within(dialog).getByRole("button", {
      name: /先発固定/,
    });
    fireEvent.click(starterLock);
    await waitFor(() =>
      expect(
        within(
          screen.getByRole("dialog", {
            name: "ローテーション1の選手を選択",
          }),
        ).getByRole("button", { name: /先発固定/ }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    dialog = screen.getByRole("dialog", {
      name: "ローテーション1の選手を選択",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));

    fireEvent.click(
      screen.getByRole("checkbox", { name: "怪我時はベンチを許可" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "怪我時はベンチを許可" }),
      ).not.toBeChecked(),
    );

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    await openLineupScreen();
    fireEvent.click(
      screen.getByRole("button", { name: "ローテーション1を変更" }),
    );

    expect(
      within(
        screen.getByRole("dialog", {
          name: "ローテーション1の選手を選択",
        }),
      ).getByRole("button", { name: /先発固定/ }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(
      within(
        screen.getByRole("dialog", {
          name: "ローテーション1の選手を選択",
        }),
      ).getByRole("button", { name: "閉じる" }),
    );
    expect(
      screen.getByRole("checkbox", { name: "怪我時はベンチを許可" }),
    ).not.toBeChecked();
  });

  it("can rebuild and safety-adjust the lineup", async () => {
    render(<App />);
    await openLineupScreen();

    fireEvent.click(screen.getByRole("button", { name: "自動編成" }));
    await screen.findByText("保存済み ✓");
    fireEvent.click(screen.getByRole("button", { name: "安全調整" }));

    await waitFor(() =>
      expect(screen.getByText("編成は有効です")).toBeInTheDocument(),
    );
  });
});
