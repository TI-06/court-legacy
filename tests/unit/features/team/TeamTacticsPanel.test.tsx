import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MatchTacticPlan } from "../../../../src/domain/team/matchTactics";
import { TeamTacticsPanel } from "../../../../src/features/team/TeamTacticsPanel";

const balancedPlan: MatchTacticPlan = {
  serve: "balanced",
  attack: "balanced",
  block: "mixed",
};

function selectedOption(groupName: string) {
  return within(screen.getByRole("group", { name: groupName })).getByRole(
    "button",
    { pressed: true },
  );
}

describe("TeamTacticsPanel", () => {
  it("shows all three volleyball tactic axes with the authoritative plan selected", () => {
    render(
      <TeamTacticsPanel
        currentPlan={balancedPlan}
        onSave={vi.fn()}
        pending={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "基本戦術" })).toBeVisible();
    expect(selectedOption("サーブ戦術")).toHaveTextContent("バランス");
    expect(selectedOption("攻撃戦術")).toHaveTextContent("バランス");
    expect(selectedOption("ブロック戦術")).toHaveTextContent("ミックス");
    expect(screen.getByText(/ミスを抑える/)).toBeVisible();
    expect(screen.getByText(/MB参加/)).toBeVisible();
    expect(screen.getByText(/トスを見て/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "基本戦術を保存" }),
    ).toBeDisabled();
  });

  it("keeps edits local until save and emits one complete plan", () => {
    const onSave = vi.fn();
    render(
      <TeamTacticsPanel
        currentPlan={balancedPlan}
        onSave={onSave}
        pending={false}
      />,
    );

    fireEvent.click(
      within(screen.getByRole("group", { name: "サーブ戦術" })).getByRole(
        "button",
        { name: /強気/ },
      ),
    );
    fireEvent.click(
      within(screen.getByRole("group", { name: "攻撃戦術" })).getByRole(
        "button",
        { name: /高速/ },
      ),
    );

    expect(onSave).not.toHaveBeenCalled();
    const save = screen.getByRole("button", { name: "基本戦術を保存" });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      serve: "aggressive",
      attack: "quick",
      block: "mixed",
    });
  });

  it("disables editing while pending and resynchronizes after an authoritative update", () => {
    const { rerender } = render(
      <TeamTacticsPanel
        currentPlan={balancedPlan}
        onSave={vi.fn()}
        pending={false}
      />,
    );

    fireEvent.click(
      within(screen.getByRole("group", { name: "ブロック戦術" })).getByRole(
        "button",
        { name: /リード/ },
      ),
    );
    expect(selectedOption("ブロック戦術")).toHaveTextContent("リード");

    const authoritativePlan: MatchTacticPlan = {
      serve: "safe",
      attack: "side",
      block: "commit",
    };
    rerender(
      <TeamTacticsPanel
        currentPlan={authoritativePlan}
        onSave={vi.fn()}
        pending={true}
      />,
    );

    expect(selectedOption("サーブ戦術")).toHaveTextContent("安全重視");
    expect(selectedOption("攻撃戦術")).toHaveTextContent("サイド重視");
    expect(selectedOption("ブロック戦術")).toHaveTextContent("コミット");
    expect(
      screen.getByRole("button", { name: "基本戦術を保存" }),
    ).toBeDisabled();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
