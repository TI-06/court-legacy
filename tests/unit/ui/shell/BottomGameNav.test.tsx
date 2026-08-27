import { fireEvent, render, screen } from "@testing-library/react";
import { BottomGameNav } from "../../../../src/ui/shell/BottomGameNav";

describe("BottomGameNav", () => {
  it("shows the five V2 primary actions and marks the active tab", () => {
    const onChange = vi.fn();

    render(<BottomGameNav activeTab="home" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "ホーム" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "選手" })).toBeVisible();
    expect(screen.getByRole("button", { name: "育成" })).toBeVisible();
    expect(screen.getByRole("button", { name: "試合" })).toBeVisible();
    expect(screen.getByRole("button", { name: "その他" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "学校" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    expect(onChange).toHaveBeenCalledWith("more");
  });
});
