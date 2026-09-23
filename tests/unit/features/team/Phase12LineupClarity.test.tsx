import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../../../../src/App";

async function openLineup(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: "選手" }));
  fireEvent.click(screen.getByRole("button", { name: "編成" }));
}

describe("Phase 12 lineup clarity", () => {
  it("shows role first and keeps the rotation number secondary", async () => {
    render(<App />);
    await openLineup();

    const first = screen.getAllByTestId("court-player")[0]!;
    expect(first).toHaveTextContent(/^(S|OH|MB|OP)/);
    expect(first).toHaveTextContent("R1");
  });

  it("keeps the replacement target and current player visible in the picker", async () => {
    render(<App />);
    await openLineup();

    fireEvent.click(screen.getAllByTestId("court-player")[0]!);
    const dialog = screen.getByRole("dialog", {
      name: "ローテーション1を入れ替え",
    });

    expect(within(dialog).getByText("変更する枠")).toBeVisible();
    expect(within(dialog).getByText("ローテーション1")).toBeVisible();
    expect(within(dialog).getByText(/現在：/)).toBeVisible();
    expect(within(dialog).getByText(/候補 \d+人・適性順/)).toBeVisible();

    const candidates = within(dialog).getAllByTestId("player-picker-option");
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThan(12);
    expect(within(candidates[0]!).getByText("おすすめ")).toBeVisible();
    expect(candidates[0]).toHaveTextContent(/適性 \d+/);
    expect(within(candidates[0]!).getByText("総合")).toBeVisible();
    expect(
      candidates[0]!.querySelector(".team-picker-card__score strong"),
    ).toHaveTextContent(/\d+/);
    expect(candidates[0]).toHaveTextContent(/攻 \d+/);
    expect(candidates[0]).toHaveTextContent(/守 \d+/);
    expect(candidates[0]).toHaveTextContent(/跳 \d+/);
  });

  it("uses game-style policy switches without native checkbox controls", async () => {
    render(<App />);
    await openLineup();

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(
      screen.getByRole("switch", { name: "怪我時はベンチを許可" }),
    ).toBeVisible();
    expect(
      screen.getByRole("switch", { name: "試合中の自動交代" }),
    ).toBeVisible();
    expect(
      screen.getByRole("switch", { name: "セット間の自動変更" }),
    ).toBeVisible();
    expect(screen.queryByText(/疲労85以上/)).toBeNull();
  });
});
