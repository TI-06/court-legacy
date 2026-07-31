import { fireEvent, render, screen } from "@testing-library/react";
import { BottomGameNav } from "../../../../src/ui/shell/BottomGameNav";

describe("BottomGameNav", () => {
  it("shows five primary actions and marks the active tab", () => {
    const onChange = vi.fn();

    render(<BottomGameNav activeTab="home" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "ホーム" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "選手" })).toBeVisible();
    expect(screen.getByRole("button", { name: "育成" })).toBeVisible();
    expect(screen.getByRole("button", { name: "試合" })).toBeVisible();
    expect(screen.getByRole("button", { name: "学校" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "選手" }));
    expect(onChange).toHaveBeenCalledWith("team");
  });
});
