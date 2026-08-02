import { render, screen } from "@testing-library/react";
import { StatBar } from "../../../../src/ui/theme/StatBar";

describe("StatBar", () => {
  it("clamps values to the supported percentage range", () => {
    const { rerender } = render(<StatBar label="攻撃" value={150} />);

    expect(screen.getByTestId("stat-bar-fill")).toHaveStyle({ width: "100%" });

    rerender(<StatBar label="守備" value={-20} />);
    expect(screen.getByTestId("stat-bar-fill")).toHaveStyle({ width: "0%" });
  });

  it("keeps the label and explicit value readable", () => {
    render(<StatBar label="疲労" value={42} valueLabel="42 / 100" />);

    expect(screen.getByText("疲労")).toBeVisible();
    expect(screen.getByText("42 / 100")).toBeVisible();
  });
});
