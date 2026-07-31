import { fireEvent, render, screen } from "@testing-library/react";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PlayerHubScreen } from "../../../../src/features/team/PlayerHubScreen";

describe("PlayerHubScreen", () => {
  it("opens a player detail and returns to the roster", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;

    render(
      <PlayerHubScreen
        onChange={vi.fn()}
        selection={selection}
        state={state}
      />,
    );

    expect(screen.getByRole("heading", { name: "選手一覧" })).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: `選手詳細 ${player.lastName} ${player.firstName}`,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: `${player.lastName} ${player.firstName}`,
      }),
    ).toBeVisible();
    expect(screen.getByText("総合力")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "選手一覧へ戻る" }));
    expect(screen.getByRole("heading", { name: "選手一覧" })).toBeVisible();
  });

  it("keeps the existing lineup editor available", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });

    render(
      <PlayerHubScreen
        onChange={vi.fn()}
        selection={selection}
        state={state}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "編成" }));
    expect(
      screen.getByRole("heading", { name: "チーム編成" }),
    ).toBeVisible();
  });
});
