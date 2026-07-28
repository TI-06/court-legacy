import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../../../../src/App";

describe("team selection direct-touch UI", () => {
  it("opens the Team tab with a court, libero, and bench rail", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "チーム" }));

    expect(
      screen.getByRole("heading", { name: "チーム編成" }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
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

  it("opens every school player in the replacement bottom sheet", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "チーム" }));
    fireEvent.click(
      screen.getByRole("button", { name: "ローテーション1を変更" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "ローテーション1の選手を選択",
    });
    expect(within(dialog).getAllByTestId("player-picker-option")).toHaveLength(12);
  });

  it("manually replaces a court player without duplicate active players", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "チーム" }));
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
    expect(screen.getByText("編成は有効です")).toBeInTheDocument();
  });

  it("persists starter locks and safety settings across tab changes", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "チーム" }));

    const starterLock = screen.getAllByRole("button", {
      name: /先発固定/,
    })[0]!;
    const injurySafety = screen.getByRole("checkbox", {
      name: "怪我時はベンチを許可",
    });
    fireEvent.click(starterLock);
    fireEvent.click(injurySafety);

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    fireEvent.click(screen.getByRole("button", { name: "チーム" }));

    expect(
      screen.getAllByRole("button", { name: /先発固定/ })[0],
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("checkbox", { name: "怪我時はベンチを許可" }),
    ).not.toBeChecked();
  });

  it("can rebuild and safety-adjust the lineup", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "チーム" }));

    fireEvent.click(screen.getByRole("button", { name: "自動編成" }));
    fireEvent.click(screen.getByRole("button", { name: "安全調整" }));

    expect(screen.getByText("編成は有効です")).toBeInTheDocument();
  });
});
