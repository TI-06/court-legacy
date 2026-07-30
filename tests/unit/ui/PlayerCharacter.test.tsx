import { render, screen } from "@testing-library/react";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { PlayerCharacter } from "../../../src/ui/PlayerCharacter";
import { PlayerTile } from "../../../src/ui/PlayerTile";

function featuredSetter() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const player = school.playerIds
    .map((id) => state.players[id])
    .find(
      (candidate) =>
        candidate &&
        `${candidate.lastName} ${candidate.firstName}` === "瀬戸 蒼真",
    );
  if (!player) {
    throw new Error("瀬戸 蒼真 must exist");
  }
  return { school, player };
}

describe("PlayerCharacter", () => {
  it("renders a featured portrait using the school identity", () => {
    const { school, player } = featuredSetter();

    render(
      <PlayerCharacter player={player} school={school} variant="portrait" />,
    );

    const character = screen.getByTestId("player-character");
    expect(character).toHaveAttribute("aria-hidden", "true");
    expect(character).toHaveAttribute("viewBox", "0 0 80 90");
    expect(character).toHaveAttribute("data-character-id", "seto-soma");
    expect(character).toHaveAttribute("data-school-motif", "wave");
    expect(character).toHaveAttribute("data-height-band");
    expect(character).toHaveAttribute("data-hair-style");
    expect(screen.getByTestId("player-character-uniform")).toHaveAttribute(
      "fill",
      `url(#jersey-${player.id})`,
    );
    expect(screen.getByTestId("player-character-accent")).toHaveAttribute(
      "fill",
      school.uniform.accent,
    );
    expect(screen.getByTestId("player-character-iris")).toHaveAttribute(
      "fill",
      "#79C7E8",
    );
    expect(screen.getByTestId("player-character-number")).toHaveTextContent(
      "7",
    );
    expect(screen.getByTestId("school-emblem")).toHaveAttribute(
      "data-school-motif",
      "wave",
    );
  });

  it("keeps generated players decorative and deterministic", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = school.playerIds
      .map((id) => state.players[id])
      .find((candidate) => candidate && candidate.lastName !== "瀬戸")!;

    render(<PlayerCharacter player={player} school={school} />);

    const character = screen.getByTestId("player-character");
    expect(character).toHaveAttribute("viewBox", "0 0 80 112");
    expect(character).toHaveAttribute(
      "data-character-id",
      `generated-${player.appearanceSeed}`,
    );
    expect(character).toHaveAttribute("data-school-motif", "wave");
  });

  it("replaces the text-only avatar inside PlayerTile", () => {
    const { school, player } = featuredSetter();

    render(<PlayerTile player={player} school={school} />);

    expect(screen.getByTestId("player-character")).toBeVisible();
    expect(screen.getByText("背番号 7")).toBeVisible();
    expect(
      screen.getByText(
        `${player.grade}年・${player.preferredPosition}・${player.heightCm}cm`,
      ),
    ).toBeVisible();
  });
});
