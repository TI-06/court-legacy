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
  it("renders compact touch-first drag surfaces for court, libero, and bench", async () => {
    const view = render(<App />);
    await openLineupScreen();

    expect(
      screen.getByRole("heading", { name: "チーム編成" }),
    ).toBeInTheDocument();
    expect(screen.getByText("長押しで移動・タップで編集")).toBeVisible();
    expect(screen.getByText("先発6人")).toBeVisible();
    expect(screen.getByText("守備専門")).toBeVisible();
    expect(screen.getByText("控え選手")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "保存編成を開く" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "交代方針を開く" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("switch", { name: "怪我時はベンチを許可" }),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.getAllByTestId("court-player")).toHaveLength(6);
    expect(
      view.container.querySelectorAll('[data-drag-placement^="rotation:"]'),
    ).toHaveLength(6);
    expect(
      view.container.querySelectorAll('[data-drag-placement^="bench:"]'),
    ).toHaveLength(5);
    expect(
      view.container.querySelector('[data-drag-placement="libero"]'),
    ).not.toBeNull();
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
    const benchPlayers = screen.getAllByTestId("bench-player");
    expect(benchPlayers).toHaveLength(5);
    for (const benchPlayer of benchPlayers) {
      expect(
        within(benchPlayer).getByRole("button", { name: /を起用$/ }),
      ).toBeVisible();
    }
  });

  it("taps a bench player and chooses the court slot to swap into", async () => {
    render(<App />);
    await openLineupScreen();

    const benchPlayer = screen.getAllByTestId("bench-player")[0]!;
    fireEvent.click(
      within(benchPlayer).getByRole("button", { name: /を起用$/ }),
    );

    const dialog = screen.getByRole("dialog", { name: /の起用先$/ });
    expect(
      within(dialog).getByRole("button", { name: "ローテーション1へ起用" }),
    ).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "リベロへ起用" }),
    ).toBeVisible();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "ローテーション1へ起用" }),
    );

    expect(screen.queryByRole("dialog", { name: /の起用先$/ })).toBeNull();
    await waitFor(() =>
      expect(screen.getByText("編成は有効です")).toBeInTheDocument(),
    );
  });

  it("opens only available replacements and starter lock in the slot editor", async () => {
    render(<App />);
    await openLineupScreen();
    fireEvent.click(
      screen.getByRole("button", { name: "ローテーション1を変更" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "ローテーション1を入れ替え",
    });
    expect(within(dialog).getAllByTestId("player-picker-option")).toHaveLength(
      5,
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
      name: "ローテーション1を入れ替え",
    });
    const replacement = within(dialog)
      .getAllByTestId("player-picker-option")
      .find((button) => !button.hasAttribute("disabled"));
    expect(replacement).toBeDefined();

    fireEvent.click(replacement!);

    expect(
      screen.queryByRole("dialog", {
        name: "ローテーション1を入れ替え",
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
      name: "ローテーション1を入れ替え",
    });
    const starterLock = within(dialog).getByRole("button", {
      name: /先発固定/,
    });
    fireEvent.click(starterLock);
    await waitFor(() =>
      expect(
        within(
          screen.getByRole("dialog", {
            name: "ローテーション1を入れ替え",
          }),
        ).getByRole("button", { name: /先発固定/ }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    dialog = screen.getByRole("dialog", {
      name: "ローテーション1を入れ替え",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));

    fireEvent.click(screen.getByRole("button", { name: "交代方針を開く" }));
    let policyDialog = screen.getByRole("dialog", { name: "交代方針" });
    fireEvent.click(
      within(policyDialog).getByRole("switch", {
        name: "怪我時はベンチを許可",
      }),
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog", { name: "交代方針" })).getByRole(
          "switch",
          { name: "怪我時はベンチを許可" },
        ),
      ).toHaveAttribute("aria-checked", "false"),
    );
    policyDialog = screen.getByRole("dialog", { name: "交代方針" });
    fireEvent.click(
      within(policyDialog).getByRole("button", { name: "閉じる" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    await openLineupScreen();
    fireEvent.click(
      screen.getByRole("button", { name: "ローテーション1を変更" }),
    );

    expect(
      within(
        screen.getByRole("dialog", {
          name: "ローテーション1を入れ替え",
        }),
      ).getByRole("button", { name: /先発固定/ }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(
      within(
        screen.getByRole("dialog", {
          name: "ローテーション1を入れ替え",
        }),
      ).getByRole("button", { name: "閉じる" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "交代方針を開く" }));
    policyDialog = screen.getByRole("dialog", { name: "交代方針" });
    expect(
      within(policyDialog).getByRole("switch", {
        name: "怪我時はベンチを許可",
      }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("can rebuild and safety-adjust the lineup", async () => {
    render(<App />);
    await openLineupScreen();

    fireEvent.click(screen.getByRole("button", { name: "自動編成" }));
    await screen.findByText("保存済み ✓");
    fireEvent.click(screen.getByRole("button", { name: "交代方針を開く" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "交代方針" })).getByRole(
        "button",
        { name: "安全調整" },
      ),
    );

    await waitFor(() =>
      expect(screen.getByText("編成は有効です")).toBeInTheDocument(),
    );
  });
});
