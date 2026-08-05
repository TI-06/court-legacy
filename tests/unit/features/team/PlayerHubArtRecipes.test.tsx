import { fireEvent, render, screen } from "@testing-library/react";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { resolveFeaturedCharacter } from "../../../../src/domain/appearance/characterWorld";
import type { PlayerArtRecipe } from "../../../../src/domain/appearance/playerArtRecipe";
import type { Player } from "../../../../src/domain/model/Player";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PlayerHubScreen } from "../../../../src/features/team/PlayerHubScreen";

interface MockPlayerArtProps {
  player: Player;
  recipeOverride?: PlayerArtRecipe;
}

vi.mock("../../../../src/ui/player-art/PlayerArt", () => ({
  PlayerArt: ({ player, recipeOverride }: MockPlayerArtProps) => (
    <span
      data-player-id={player.id}
      data-recipe-salt={recipeOverride?.variationSalt ?? "missing"}
      data-testid="mock-player-art"
    />
  ),
}));

describe("PlayerHubScreen art recipes", () => {
  it("reuses the same resolved recipe in roster and player detail", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = school.playerIds
      .map((playerId) => state.players[playerId]!)
      .find(
        (candidate) => resolveFeaturedCharacter(candidate, school) === null,
      )!;
    const selection = autoSelectTeam({ state, schoolId: school.id });

    render(
      <PlayerHubScreen
        onChange={vi.fn()}
        selection={selection}
        state={state}
      />,
    );

    const rosterArt = screen
      .getAllByTestId("mock-player-art")
      .find((element) => element.dataset.playerId === player.id)!;
    const rosterSalt = rosterArt.dataset.recipeSalt;
    expect(rosterSalt).not.toBe("missing");

    fireEvent.click(
      screen.getByRole("button", {
        name: `選手詳細 ${player.lastName} ${player.firstName}`,
      }),
    );

    const detailArt = screen
      .getAllByTestId("mock-player-art")
      .find((element) => element.dataset.playerId === player.id)!;
    expect(detailArt.dataset.recipeSalt).toBe(rosterSalt);
  });
});
