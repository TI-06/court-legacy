import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpecialProjectActivityResultDialog } from "../../../../src/features/home/SpecialProjectActivityResultDialog";

describe("SpecialProjectActivityResultDialog", () => {
  it("shows university joint-training results and closes locally", () => {
    const onClose = vi.fn();

    render(
      <SpecialProjectActivityResultDialog
        onClose={onClose}
        result={{
          focus: "defense",
          participantCount: 12,
          totalAbilityGrowth: 24,
          injuredPlayerIds: ["player-1"],
        }}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "大学チーム合同練習の結果" }),
    ).toBeVisible();
    expect(screen.getByText("守備")).toBeVisible();
    expect(screen.getByText("12人")).toBeVisible();
    expect(screen.getByText("+24")).toBeVisible();
    expect(screen.getByText("1人")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "結果を確認した" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
