import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PlayerHubScreen } from "../../../../src/features/team/PlayerHubScreen";

describe("PlayerHubScreen initial player focus", () => {
  it("opens the requested player detail without persisting navigation state", () => {
    const state = createDemoGame();
    const player =
      state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;
    const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });

    render(
      <PlayerHubScreen
        initialPlayerId={player.id}
        onAssignLeadership={vi.fn()}
        onChange={vi.fn()}
        selection={selection}
        state={state}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: `${player.lastName} ${player.firstName}`,
      }),
    ).toBeVisible();
  });
});
