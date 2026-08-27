import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../../../../src/App";

describe("weekly training bottom-sheet flow", () => {
  it("opens from the home action and the training navigation", async () => {
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: /育成を決める/ }),
    );
    expect(
      screen.getByRole("heading", { name: "週間練習" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "育成" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps the main screen compact and opens team menus in a bottom sheet", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "育成" }));

    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryAllByTestId("team-training-choice")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "チーム練習を変更" }));
    const dialog = screen.getByRole("dialog", {
      name: "チーム練習を選択",
    });
    expect(within(dialog).getAllByTestId("team-training-choice")).toHaveLength(
      12,
    );

    const choices = within(dialog).getAllByTestId("team-training-choice");
    fireEvent.click(choices[1]!);
    expect(
      screen.queryByRole("dialog", { name: "チーム練習を選択" }),
    ).toBeNull();
  });

  it("opens player and instruction pickers without duplicate assignments", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "育成" }));

    fireEvent.click(
      screen.getByRole("button", { name: "個人指示2の選手を変更" }),
    );
    const playerDialog = screen.getByRole("dialog", {
      name: "個人指示2の選手を選択",
    });
    expect(
      within(playerDialog).getAllByTestId("player-picker-option"),
    ).toHaveLength(12);
    expect(
      within(playerDialog).getByRole("button", { name: /選択中/ }),
    ).toBeDisabled();
    fireEvent.click(
      within(playerDialog).getByRole("button", { name: "閉じる" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "個人指示1の内容を変更" }),
    );
    const instructionDialog = screen.getByRole("dialog", {
      name: "個人指示1の内容を選択",
    });
    expect(
      within(instructionDialog).getAllByTestId("individual-instruction-choice"),
    ).toHaveLength(6);
  });

  it("confirms training, executes it once, and keeps detailed results collapsed", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "育成" }));

    fireEvent.click(screen.getByRole("button", { name: "練習を実行" }));
    const confirmation = screen.getByRole("dialog", {
      name: "練習内容を確認",
    });
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "この内容で実行" }),
    );

    expect(
      await screen.findByRole("heading", { name: "今週の練習結果" }),
    ).toBeInTheDocument();
    expect(screen.queryAllByTestId("training-result-player")).toHaveLength(0);
    fireEvent.click(screen.getByText("選手別の結果を確認"));
    expect(screen.getAllByTestId("training-result-player")).toHaveLength(12);
    expect(
      screen.getByRole("button", { name: "今週の練習は完了" }),
    ).toBeDisabled();
  });

  it("advances to the next week after training and enables training again", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "育成" }));
    fireEvent.click(screen.getByRole("button", { name: "練習を実行" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "練習内容を確認" })).getByRole(
        "button",
        { name: "この内容で実行" },
      ),
    );
    await screen.findByRole("heading", { name: "今週の練習結果" });

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    const nextWeekButton = screen.getByRole("button", {
      name: "次の週へ進む",
    });
    expect(nextWeekButton).toBeEnabled();
    fireEvent.click(nextWeekButton);

    expect(await screen.findAllByText("2026年4月8日")).not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "育成" }));
    expect(screen.getByRole("button", { name: "練習を実行" })).toBeEnabled();
    expect(
      screen.queryByRole("heading", { name: "今週の練習結果" }),
    ).toBeNull();
  });
});
