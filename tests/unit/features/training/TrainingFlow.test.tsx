import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../../../../src/App";

describe("Phase 12 player training flow", () => {
  function openFirstPlayerTraining() {
    fireEvent.click(screen.getByRole("button", { name: "選手" }));
    const trainingButton = screen.getAllByRole("button", { name: / 練習 / })[0];
    if (!trainingButton) {
      throw new Error("player training button missing");
    }
    fireEvent.click(trainingButton);
    return screen.getByRole("dialog", { name: /の個人練習$/ });
  }

  it("uses the player roster instead of the legacy training tab", async () => {
    render(<App />);

    await screen.findByRole("button", { name: "選手" });
    expect(screen.queryByRole("button", { name: "育成" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "選手" }));
    expect(screen.getByRole("heading", { name: "選手一覧" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: / 練習 / }).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.queryByRole("button", { name: /チーム練習.*変更/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "この内容で設定" }),
    ).toBeNull();
  });

  it("opens an individual-training sheet directly from a player row", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "選手" });

    const dialog = openFirstPlayerTraining();
    expect(within(dialog).getByRole("button", { name: /^全体/ })).toBeVisible();
    expect(within(dialog).getAllByRole("button").length).toBeGreaterThan(1);
    expect(
      screen.queryByRole("dialog", { name: "練習設定を確認" }),
    ).toBeNull();
  });

  it("saves a player training choice immediately without the old confirmation flow", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "選手" });

    const dialog = openFirstPlayerTraining();
    fireEvent.click(within(dialog).getByRole("button", { name: /^全体/ }));

    expect(
      screen.queryByRole("dialog", { name: /の個人練習$/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("dialog", { name: "練習設定を確認" }),
    ).toBeNull();
    expect(await screen.findByText("保存済み ✓")).toBeVisible();
  });

  it("resolves the saved training together with next-week progression", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "選手" });

    const dialog = openFirstPlayerTraining();
    fireEvent.click(within(dialog).getByRole("button", { name: /^全体/ }));
    await screen.findByText("保存済み ✓");

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    const nextWeekButton = screen.getByRole("button", {
      name: "次の週へ進む",
    });
    expect(nextWeekButton).toBeEnabled();
    fireEvent.click(nextWeekButton);

    expect(await screen.findAllByText("2026年4月8日")).not.toHaveLength(0);
    expect(
      screen.getByRole("button", { name: /今週の練習結果/ }),
    ).toBeVisible();
  });
});
