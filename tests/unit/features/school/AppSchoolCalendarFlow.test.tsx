import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../../../../src/App";

describe("school and calendar app integration", () => {
  it("opens school management and keeps a facility upgrade in app state", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "学校" }));
    expect(
      screen.getByRole("heading", { name: "青葉高校" }),
    ).toBeInTheDocument();
    expect(screen.getByText("資金 300")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "トレーニング設備を強化" }),
    );
    const dialog = screen.getByRole("dialog", { name: "設備を強化" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "70を使って強化" }),
    );

    expect(screen.getByText("資金 230")).toBeInTheDocument();
    const trainingUpgradeButton = screen.getByRole("button", {
      name: "トレーニング設備を強化",
    });
    const trainingFacilityCard = trainingUpgradeButton.closest("article");
    expect(trainingFacilityCard).not.toBeNull();
    expect(within(trainingFacilityCard!).getByText("Lv.1")).toBeInTheDocument();
  });

  it("opens the calendar from the header and returns focus when closed", async () => {
    render(<App />);

    const opener = await screen.findByRole("button", { name: "予定を確認" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "週間カレンダー" });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));
    expect(
      screen.queryByRole("dialog", { name: "週間カレンダー" }),
    ).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("advances through the shared weekly callback from the calendar", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "育成" }));
    fireEvent.click(screen.getByRole("button", { name: "練習を実行" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "練習内容を確認" })).getByRole(
        "button",
        { name: "この内容で実行" },
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "予定を確認" }));
    const calendar = screen.getByRole("dialog", { name: "週間カレンダー" });
    const advance = within(calendar).getByRole("button", {
      name: "次の週へ進む",
    });
    expect(advance).toBeEnabled();
    fireEvent.click(advance);

    expect(
      screen.queryByRole("dialog", { name: "週間カレンダー" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "監督ホーム" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2026年4月8日")).toBeInTheDocument();
  });
});
