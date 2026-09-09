import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { deriveMatchTacticPlan } from "../../../../src/domain/team/matchTactics";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PlayerHubScreen } from "../../../../src/features/team/PlayerHubScreen";

function renderHub({ pending = false }: { pending?: boolean } = {}) {
  const state = createDemoGame();
  const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });
  const onSetTeamTactics = vi.fn();

  render(
    <PlayerHubScreen
      onAssignLeadership={vi.fn()}
      onChange={vi.fn()}
      onSetTeamTactics={onSetTeamTactics}
      selection={selection}
      state={state}
      tacticsPending={pending}
    />,
  );

  return { state, onSetTeamTactics };
}

describe("PlayerHubScreen team tactics", () => {
  it("adds a fourth tactics tab and derives the authoritative school plan", () => {
    const { state } = renderHub();
    const navigation = screen.getByRole("navigation", {
      name: "選手画面の表示切替",
    });

    expect(within(navigation).getAllByRole("button")).toHaveLength(4);
    for (const label of ["選手一覧", "編成", "チーム状態", "戦術"]) {
      expect(
        within(navigation).getByRole("button", { name: label }),
      ).toBeVisible();
    }

    fireEvent.click(within(navigation).getByRole("button", { name: "戦術" }));

    expect(screen.getByRole("heading", { name: "基本戦術" })).toBeVisible();
    const school = state.schools[state.userSchoolId]!;
    const plan = deriveMatchTacticPlan(school.tactics);
    expect(
      within(screen.getByRole("group", { name: "サーブ戦術" })).getByRole(
        "button",
        { pressed: true },
      ),
    ).toHaveTextContent(
      plan.serve === "aggressive"
        ? "強気"
        : plan.serve === "safe"
          ? "安全重視"
          : "バランス",
    );
  });

  it("submits one complete tactic plan through the Player Hub callback", () => {
    const { onSetTeamTactics } = renderHub();
    fireEvent.click(screen.getByRole("button", { name: "戦術" }));

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
    fireEvent.click(
      within(screen.getByRole("group", { name: "ブロック戦術" })).getByRole(
        "button",
        { name: /リード/ },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "基本戦術を保存" }));

    expect(onSetTeamTactics).toHaveBeenCalledTimes(1);
    expect(onSetTeamTactics).toHaveBeenCalledWith({
      serve: "aggressive",
      attack: "quick",
      block: "read",
    });
  });

  it("disables tactics mutations while an authoritative save is pending", () => {
    renderHub({ pending: true });
    fireEvent.click(screen.getByRole("button", { name: "戦術" }));

    for (const groupName of ["サーブ戦術", "攻撃戦術", "ブロック戦術"]) {
      const buttons = within(
        screen.getByRole("group", { name: groupName }),
      ).getAllByRole("button");
      expect(buttons.every((button) => button.hasAttribute("disabled"))).toBe(
        true,
      );
    }
    expect(
      screen.getByRole("button", { name: "基本戦術を保存" }),
    ).toBeDisabled();
  });
});
