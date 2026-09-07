import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { SchoolScreen } from "../../../../src/features/school/SchoolScreen";

describe("school staff screen", () => {
  it("shows the four annual assistant coach options from School", () => {
    const state = createDemoGame();

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);

    fireEvent.click(screen.getByRole("button", { name: "スタッフ" }));

    expect(screen.getByRole("heading", { name: "スタッフ" })).toBeVisible();
    expect(screen.getByText("初級コーチ")).toBeVisible();
    expect(screen.getByText("中級コーチ")).toBeVisible();
    expect(screen.getByText("上級コーチ")).toBeVisible();
    expect(screen.getByText("マスターコーチ")).toBeVisible();
    expect(screen.getByText(/年間 80/)).toBeVisible();
    expect(screen.getByText(/年間 900/)).toBeVisible();
  });

  it("shows the current annual contract", () => {
    const state = createDemoGame();
    state.schoolManagement.assistantCoach = {
      rank: "advanced",
      specialty: "attack",
      contractYearIndex: state.yearIndex,
    };

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);

    fireEvent.click(screen.getByRole("button", { name: "スタッフ" }));

    expect(screen.getByText("契約中")).toBeVisible();
    expect(screen.getByText(/上級コーチ/)).toBeVisible();
    expect(screen.getByText(/攻撃/)).toBeVisible();
  });

  it("selects a specialty and requests the annual contract", () => {
    const state = createDemoGame();
    const onContractAssistantCoach = vi.fn();

    render(
      <SchoolScreen
        onContractAssistantCoach={onContractAssistantCoach}
        onUpgradeFacility={vi.fn()}
        state={state}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "スタッフ" }));
    const advancedCard = screen.getByTestId("assistant-coach-advanced");
    fireEvent.change(within(advancedCard).getByRole("combobox"), {
      target: { value: "attack" },
    });
    fireEvent.click(
      within(advancedCard).getByRole("button", {
        name: "上級コーチと年間契約",
      }),
    );

    expect(onContractAssistantCoach).toHaveBeenCalledWith(
      "advanced",
      "attack",
    );
  });
});
