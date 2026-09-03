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
    expect(within(dialog).getAllByTestId("player-picker-option")).toHaveLength(
      12,
    );
  });

  it("does not expose fatigue-driven benching controls", async () => {
    render(<App />);
    await openLineup();

    expect(
      screen.queryByRole("checkbox", { name: "重度疲労時はベンチを許可" }),
    ).toBeNull();
    expect(screen.queryByText(/疲労85以上/)).toBeNull();
  });
});
