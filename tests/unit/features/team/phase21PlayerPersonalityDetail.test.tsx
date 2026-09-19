import { fireEvent, render, screen, within } from "@testing-library/react";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { getPlayerPersonalityPresentation } from "../../../../src/domain/player/playerPersonalityPresentation";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PlayerHubScreen } from "../../../../src/features/team/PlayerHubScreen";

describe("Phase21 Player Hub personality", () => {
  it("shows the selected player's public personality and qualitative tendencies", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;
    const definition = gameData.personalities.get(player.personalityId)!;
    const expected = getPlayerPersonalityPresentation(definition);

    render(
      <PlayerHubScreen
        data={gameData}
        onAssignLeadership={vi.fn()}
        onChange={vi.fn()}
        selection={autoSelectTeam({ state, schoolId: state.userSchoolId })}
        state={state}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: `選手詳細 ${player.lastName} ${player.firstName}`,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "人物" }));

    const region = screen.getByRole("region", { name: "性格" });
    expect(within(region).getByRole("heading", { name: "性格" })).toBeVisible();
    expect(within(region).getByText(expected.name)).toBeVisible();
    expect(within(region).getByText(expected.description)).toBeVisible();
    expect(
      within(region).getByText(`練習 ${expected.trainingStability}`),
    ).toBeVisible();
    expect(
      within(region).getByText(`関係構築 ${expected.relationshipBuilding}`),
    ).toBeVisible();
    expect(
      within(region).getByText(`プレッシャー ${expected.pressureResponse}`),
    ).toBeVisible();
    expect(
      within(region).getByText(`士気 ${expected.moraleVolatility}`),
    ).toBeVisible();
  });
});
