import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../../../../src/App";

describe("weekly training UI", () => {
  it("opens from the required home action and the training navigation", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "今週の方針を設定" }));
    expect(
      screen.getByRole("heading", { name: "週間練習" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "育成" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    expect(
      screen.getByRole("heading", { name: "練習方針を決める" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "育成" }));
    expect(
      screen.getByRole("heading", { name: "週間練習" }),
    ).toBeInTheDocument();
  });

  it("shows all team menus and individual instruction choices", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "育成" }));

    const teamMenu = screen.getByRole("combobox", { name: "チーム練習" });
    const firstInstruction = screen.getByRole("combobox", {
      name: "個人指示1 内容",
    });
    const secondInstruction = screen.getByRole("combobox", {
      name: "個人指示2 内容",
    });

    expect(within(teamMenu).getAllByRole("option")).toHaveLength(12);
    expect(within(firstInstruction).getAllByRole("option")).toHaveLength(6);
    expect(within(secondInstruction).getAllByRole("option")).toHaveLength(6);
    expect(
      within(
        screen.getByRole("combobox", { name: "個人指示1 選手" }),
      ).getAllByRole("option"),
    ).toHaveLength(12);
  });

  it("blocks duplicate individual player assignments", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "育成" }));

    const firstPlayer = screen.getByRole("combobox", {
      name: "個人指示1 選手",
    }) as HTMLSelectElement;
    const secondPlayer = screen.getByRole("combobox", {
      name: "個人指示2 選手",
    });

    fireEvent.change(secondPlayer, { target: { value: firstPlayer.value } });

    expect(
      screen.getByText("個人指示は異なる選手を選んでください。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "練習を実行" })).toBeDisabled();
  });

  it("executes training and shows an explainable result for every player", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "育成" }));
    fireEvent.click(screen.getByRole("button", { name: "練習を実行" }));

    expect(
      screen.getByRole("heading", { name: "今週の練習結果" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("training-result-player")).toHaveLength(12);
    expect(screen.getByText(/能力成長/)).toBeInTheDocument();
    expect(screen.getByText(/疲労/)).toBeInTheDocument();
  });
});
