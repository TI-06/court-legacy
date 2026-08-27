import { fireEvent, render, screen } from "@testing-library/react";
import App from "../../../../src/App";

describe("app match integration", () => {
  it("runs one practice match, keeps the result, and closes the weekly action", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /練習試合へ/ }));
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
    expect(
      screen.getByRole("button", { name: /今週の練習試合は完了/ }),
    ).toBeDisabled();
  });

  it("opens match preparation from the bottom navigation before a match", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "試合" }));

    expect(
      screen.getByRole("heading", { name: "練習試合" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "試合" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
