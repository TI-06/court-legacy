import { fireEvent, render, screen, within } from "@testing-library/react";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { calculatePlayerDisplayPower } from "../../../../src/domain/selectors/playerPresentation";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PlayerHubScreen } from "../../../../src/features/team/PlayerHubScreen";

function renderPlayerHub() {
  const state = createDemoGame();
  const selection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const view = render(
    <PlayerHubScreen onChange={vi.fn()} selection={selection} state={state} />,
  );

  return { state, selection, view };
}

describe("PlayerHubScreen", () => {
  it("renders a portrait-free information-first roster", () => {
    const { state, view } = renderPlayerHub();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;
    const rows = screen.getAllByTestId("roster-player-row");

    expect(rows).toHaveLength(school.playerIds.length);
    expect(view.container.querySelector("img")).toBeNull();

    const firstRow = rows[0]!;
    expect(within(firstRow).getByText("1")).toBeVisible();
    expect(
      within(firstRow).getByText(`${player.lastName} ${player.firstName}`),
    ).toBeVisible();
    expect(within(firstRow).getByText(`${player.grade}年`)).toBeVisible();
    expect(within(firstRow).getByText(player.preferredPosition)).toBeVisible();
    expect(within(firstRow).getByText(`${player.heightCm}cm`)).toBeVisible();
    expect(
      within(firstRow).getByText(
        String(Math.round(calculatePlayerDisplayPower(player) / 100)),
      ),
    ).toBeVisible();
    expect(within(firstRow).getByText(String(player.condition))).toBeVisible();
  });

  it("opens a player detail and returns to the roster", () => {
    const { state } = renderPlayerHub();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;

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
    renderPlayerHub();

    fireEvent.click(screen.getByRole("button", { name: "編成" }));
    expect(screen.getByRole("heading", { name: "チーム編成" })).toBeVisible();
  });
});
