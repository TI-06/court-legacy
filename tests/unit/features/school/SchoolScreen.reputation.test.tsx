import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { SchoolScreen } from "../../../../src/features/school/SchoolScreen";

describe("school reputation presentation", () => {
  it("shows the E-SS grade derived from reputation points", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    state.schools[state.userSchoolId] = {
      ...school,
      reputationPoints: 825,
    };

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);

    expect(screen.getByText(/評判 A/)).toBeVisible();
    expect(screen.getByText(/825/)).toBeVisible();
  });
});
