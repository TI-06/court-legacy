import { fireEvent, render, screen } from "@testing-library/react";
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
});
