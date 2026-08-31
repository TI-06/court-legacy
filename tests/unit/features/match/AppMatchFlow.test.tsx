import { fireEvent, render, screen } from "@testing-library/react";
import App from "../../../../src/App";

describe("app match integration", () => {
  it("shows only practice scheduling until an opponent is confirmed", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /練習試合へ/ }));

    expect(
      screen.getByRole("heading", { name: "練習試合の予定" }),
    ).toBeInTheDocument();
    const schedulingActions = [
      ...screen.queryAllByRole("button", { name: "受ける" }),
      ...screen.queryAllByRole("button", { name: /に申し込む/ }),
    ];
    expect(schedulingActions.length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "試合開始" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "試合準備" }),
    ).not.toBeInTheDocument();
  });

  it("opens practice scheduling from the bottom navigation before a match", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "試合" }));

    expect(
      screen.getByRole("heading", { name: "練習試合の予定" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "試合" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.queryByRole("button", { name: "試合開始" }),
    ).not.toBeInTheDocument();
  });
});
