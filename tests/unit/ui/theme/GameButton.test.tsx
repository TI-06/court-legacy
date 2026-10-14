import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { GameButton } from "../../../../src/ui/theme/GameButton";

describe("Phase61 shared game button", () => {
  it("routes clicks without submitting a form", () => {
    const onClick = vi.fn();
    render(
      <GameButton onClick={onClick} variant="primary">
        次の週へ
      </GameButton>,
    );

    const button = screen.getByRole("button", { name: "次の週へ" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("game-button", "game-button--primary");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("honors disabled state and quiet visual variant", () => {
    const onClick = vi.fn();
    render(
      <GameButton disabled onClick={onClick} variant="quiet">
        購入
      </GameButton>,
    );
    const button = screen.getByRole("button", { name: "購入" });
    expect(button).toBeDisabled();
    expect(button).toHaveClass("game-button--quiet");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
