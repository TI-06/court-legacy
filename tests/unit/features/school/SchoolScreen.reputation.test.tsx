import { render, screen, within } from "@testing-library/react";
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

    const summary = screen.getByRole("region", { name: "学校サマリー" });
    const reputation = within(summary).getByRole("article", { name: "評判" });
    expect(reputation).toHaveTextContent("A 825");
  });
});
