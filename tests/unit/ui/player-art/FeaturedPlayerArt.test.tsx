import { fireEvent, render, screen } from "@testing-library/react";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { Player } from "../../../../src/domain/model/Player";
import type { School } from "../../../../src/domain/model/School";
import { FeaturedPlayerArt } from "../../../../src/ui/player-art/FeaturedPlayerArt";

function featuredFixture(): { player: Player; school: School } {
  const state = createDemoGame();
  const player = Object.values(state.players).find(
    (candidate) =>
      `${candidate.lastName} ${candidate.firstName}` === "黒羽 隼斗",
  );

  if (!player) {
    throw new Error("黒羽 隼斗 must exist");
  }

  return {
    player,
    school: state.schools[player.career.schoolId]!,
  };
}

describe("FeaturedPlayerArt", () => {
  it("renders the requested dedicated WebP", () => {
    const { player, school } = featuredFixture();

    render(
      <FeaturedPlayerArt
        player={player}
        school={school}
        testId="featured-art"
        variant="full"
      />,
    );

    const image = screen.getByTestId("featured-art");
    expect(image).toHaveAttribute("src", expect.stringMatching(/\.webp/));
    expect(image).toHaveAttribute("aria-hidden", "true");
  });

  it("removes a failed image without rendering generated art or SVG", () => {
    const { player, school } = featuredFixture();

    render(
      <FeaturedPlayerArt
        player={player}
        school={school}
        testId="featured-art"
        variant="full"
      />,
    );

    fireEvent.error(screen.getByTestId("featured-art"));

    expect(screen.queryByTestId("featured-art")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("generated-player-art"),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector("svg[data-testid='player-character']"),
    ).toBeNull();
  });

  it("renders nothing for a generated player", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = school.playerIds
      .map((playerId) => state.players[playerId])
      .find((candidate) => {
        return (
          candidate &&
          `${candidate.lastName} ${candidate.firstName}` !== "瀬戸 蒼真"
        );
      });

    expect(player).toBeDefined();
    const { container } = render(
      <FeaturedPlayerArt player={player!} school={school} variant="chibi" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
