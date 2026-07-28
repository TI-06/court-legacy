import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../../../../src/App";

describe("weekly training direct-touch UI", () => {
  it("opens from the required home action and the training navigation", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /育成を決める/ }));
    expect(
      screen.getByRole("heading", { name: "週間練習" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "育成" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    fireEvent.click(screen.getByRole("button", { name: "育成" }));
    expect(
      screen.getByRole("heading", { name: "週間練習" }),
    ).toBeInTheDocument();
  });

  it("shows all choices directly without native dropdowns", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "育成" }));

    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.getAllByTestId("team-training-choice")).toHaveLength(12);
    expect(screen.getAllByTestId("individual-instruction-1")).toHaveLength(6);
    expect(screen.getAllByTestId("individual-instruction-2")).toHaveLength(6);
  });

  it("opens a player bottom sheet and prevents duplicate assignments", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "育成" }));

    fireEvent.click(
      screen.getByRole("button", { name: "個人指示2の選手を変更" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "個人指示2の選手を選択",
    });
    expect(within(dialog).getAllByTestId("player-picker-option")).toHaveLength(
      12,
    );
    expect(
      within(dialog).getByRole("button", { name: /選択中/ }),
    ).toBeDisabled();
  });

  it("changes team practice by tapping a card", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "育成" }));

    const choices = screen.getAllByTestId("team-training-choice");
    fireEvent.click(choices[1]!);

    expect(choices[1]).toHaveAttribute("aria-pressed", "true");
    expect(choices[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("executes training from the sticky action bar and shows every player result", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "育成" }));
    fireEvent.click(screen.getByRole("button", { name: "練習を実行" }));

    expect(
      screen.getByRole("heading", { name: "今週の練習結果" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("training-result-player")).toHaveLength(12);
    expect(screen.getAllByText(/能力成長/).length).toBeGreaterThan(0);
  });
});
