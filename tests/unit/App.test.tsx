import { render, screen } from "@testing-library/react";
import App from "../../src/App";

const menuLabels = ["ホーム", "チーム", "育成", "試合", "学校"];

describe("mobile application shell", () => {
  it("shows the five primary navigation actions", () => {
    render(<App />);

    expect(
      screen.getByRole("navigation", { name: "主要メニュー" }),
    ).toBeInTheDocument();

    for (const label of menuLabels) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});
