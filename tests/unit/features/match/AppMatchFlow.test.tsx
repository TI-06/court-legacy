import { fireEvent, render, screen } from "@testing-library/react";
import App from "../../../../src/App";

describe("app match integration", () => {
  it("runs a practice match from home and keeps the latest result", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "練習試合へ" }));
    expect(
      screen.getByRole("heading", { name: "練習試合" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "試合開始" }));
    expect(
      screen.getByRole("heading", { name: "試合ダイジェスト" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "結果まで進む" }));
    expect(
      screen.getByRole("heading", { name: "試合結果" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ホームへ戻る" }));
    expect(
      screen.getByRole("heading", { name: "監督ホーム" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "直近の試合" }),
    ).toBeInTheDocument();
  });

  it("opens match preparation from the bottom navigation before a match", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "試合" }));

    expect(
      screen.getByRole("heading", { name: "練習試合" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "試合" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
