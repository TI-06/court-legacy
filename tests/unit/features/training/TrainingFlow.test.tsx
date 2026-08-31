import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../../../../src/App";

describe("weekly training bottom-sheet flow", () => {
  it("renders the Phase 10 training surface as compact settings-only UI", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "育成" }));

    expect(screen.getByRole("heading", { name: "育成" })).toBeInTheDocument();
    expect(screen.queryByText("直近の練習結果")).toBeNull();
    expect(screen.queryByText("来年度の戦力候補")).toBeNull();
    expect(screen.queryByText("候補を調査")).toBeNull();
    expect(screen.getByRole("button", { name: /新入生スカウト/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /個人育成 1/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /個人育成 2/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /個人指示1の選手を変更/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /個人指示1の内容を変更/ })).toBeNull();
    expect(screen.getByRole("button", { name: "この内容で設定" })).toBeEnabled();
  });

  it("opens from the home action and keeps the training navigation active", async () => {
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: /育成を決める/ }),
    );
    expect(screen.getByRole("heading", { name: "育成" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /新入生スカウト/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "育成" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens team menus from the compact team row", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "育成" }));

    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryAllByTestId("team-training-choice")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /チーム練習.*変更/ }));
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

  it("edits player and instruction inside one individual-training sheet", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "育成" }));

    fireEvent.click(screen.getByRole("button", { name: /個人育成 2/ }));
    const assignmentDialog = screen.getByRole("dialog", { name: "個人育成 2" });
    expect(within(assignmentDialog).getByRole("button", { name: "選手を変更" })).toBeVisible();
    expect(within(assignmentDialog).getByRole("button", { name: "指示を変更" })).toBeVisible();

    fireEvent.click(
      within(assignmentDialog).getByRole("button", { name: "選手を変更" }),
    );
    const playerDialog = screen.getByRole("dialog", {
      name: "個人育成2の選手を選択",
    });
    expect(
      within(playerDialog).getAllByTestId("player-picker-option"),
    ).toHaveLength(12);
    expect(
      within(playerDialog).getByRole("button", { name: /選択中/ }),
    ).toBeDisabled();
    fireEvent.click(within(playerDialog).getByRole("button", { name: "閉じる" }));

    const reopenedAssignment = screen.getByRole("dialog", { name: "個人育成 2" });
    fireEvent.click(
      within(reopenedAssignment).getByRole("button", { name: "指示を変更" }),
    );
    const instructionDialog = screen.getByRole("dialog", {
      name: "個人育成2の指示を選択",
    });
    expect(
      within(instructionDialog).getAllByTestId("individual-instruction-choice"),
    ).toHaveLength(6);
  });

  it("saves the weekly plan without resolving training immediately", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "育成" }));

    fireEvent.click(screen.getByRole("button", { name: /チーム練習.*変更/ }));
    const menuDialog = screen.getByRole("dialog", {
      name: "チーム練習を選択",
    });
    const choices = within(menuDialog).getAllByTestId("team-training-choice");
    const selectedMenuName =
      choices[1]!.querySelector("strong")?.textContent?.trim() ?? "";
    fireEvent.click(choices[1]!);

    fireEvent.click(screen.getByRole("button", { name: "この内容で設定" }));
    const confirmation = screen.getByRole("dialog", {
      name: "練習設定を確認",
    });
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "この内容で設定" }),
    );

    expect(screen.queryByText("直近の練習結果")).toBeNull();
    await screen.findByText("保存済み ✓");

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    fireEvent.click(screen.getByRole("button", { name: "育成" }));
    expect(screen.getByText(selectedMenuName)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この内容で設定" })).toBeEnabled();
  });

  it("runs the saved training together with next-week progression", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "育成" }));
    fireEvent.click(screen.getByRole("button", { name: "この内容で設定" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "練習設定を確認" })).getByRole(
        "button",
        { name: "この内容で設定" },
      ),
    );

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

    fireEvent.click(screen.getByRole("button", { name: "育成" }));
    expect(screen.queryByText("直近の練習結果")).toBeNull();
    expect(screen.getByRole("button", { name: "この内容で設定" })).toBeEnabled();
  });
});
