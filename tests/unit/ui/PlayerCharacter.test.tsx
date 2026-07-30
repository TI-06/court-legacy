import { render, screen } from "@testing-library/react";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { PlayerCharacter } from "../../../src/ui/PlayerCharacter";
import { PlayerTile } from "../../../src/ui/PlayerTile";

describe("PlayerCharacter", () => {
  it("renders a decorative layered SVG using the school uniform", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;

    render(<PlayerCharacter player={player} uniform={school.uniform} />);

    const character = screen.getByTestId("player-character");
    expect(character).toHaveAttribute("aria-hidden", "true");
    expect(character).toHaveAttribute("viewBox", "0 0 80 112");
    expect(character).toHaveAttribute("data-height-band");
    expect(character).toHaveAttribute("data-hair-style");
    expect(screen.getByTestId("player-character-uniform")).toHaveAttribute(
      "fill",
      school.uniform.primary,
    );
    expect(screen.getByTestId("player-character-accent")).toHaveAttribute(
      "fill",
      school.uniform.accent,
    );
  });

  it("replaces the text-only avatar inside PlayerTile", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;

    render(<PlayerTile player={player} uniform={school.uniform} />);

    expect(screen.getByTestId("player-character")).toBeVisible();
    expect(
      screen.getByText(
        `${player.grade}年・${player.preferredPosition}・${player.heightCm}cm`,
      ),
    ).toBeVisible();
  });
});
