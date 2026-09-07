import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { SchoolScreen } from "../../../../src/features/school/SchoolScreen";

describe("facility sequential upgrade UX", () => {
  it("keeps the facility sheet open after an upgrade so another level can follow smoothly", () => {
    const state = createDemoGame();
    const onUpgradeFacility = vi.fn();
    render(
      <SchoolScreen onUpgradeFacility={onUpgradeFacility} state={state} />,
    );

    fireEvent.click(screen.getAllByTestId("facility-tile")[0]!);
    const upgradeButton = screen.getByRole("button", { name: /を使って強化/ });
    fireEvent.click(upgradeButton);

    expect(onUpgradeFacility).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: /を使って強化/ }),
    ).toBeVisible();
  });
});
