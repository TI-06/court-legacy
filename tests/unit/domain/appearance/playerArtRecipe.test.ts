import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  createPlayerArtRecipe,
  playerArtIdentitySignature,
} from "../../../../src/domain/appearance/playerArtRecipe";

function firstPlayer() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const player = state.players[school.playerIds[0]!]!;
  return { player, school };
}

describe("player art recipe", () => {
  it("creates the same catalog-v2 recipe for the same saved player", () => {
    const { player, school } = firstPlayer();
    const recipe = createPlayerArtRecipe(player, school);

    expect(recipe).toEqual(createPlayerArtRecipe({ ...player }, school));
    expect(recipe.catalogVersion).toBe(2);
    expect(recipe.variationSalt).toBeTypeOf("number");
  });

  it("keeps identity stable while condition changes the expression", () => {
    const { player, school } = firstPlayer();
    const healthy = createPlayerArtRecipe(
      {
        ...player,
        condition: 90,
        fatigue: 0,
        morale: 60,
        injury: null,
      },
      school,
    );
    const tired = createPlayerArtRecipe(
      {
        ...player,
        condition: 90,
        fatigue: 90,
        morale: 60,
        injury: null,
      },
      school,
    );

    expect(playerArtIdentitySignature(healthy)).toBe(
      playerArtIdentitySignature(tired),
    );
    expect(healthy.expression).not.toBe(tired.expression);
  });

  it("keeps player identity independent from school colors", () => {
    const state = createDemoGame();
    const schools = Object.values(state.schools);
    const { player, school } = firstPlayer();
    const otherSchool = schools.find(
      (candidate) => candidate.id !== school.id,
    )!;

    const homeRecipe = createPlayerArtRecipe(player, school);
    const awayRecipe = createPlayerArtRecipe(player, otherSchool);

    expect(homeRecipe.schoolTheme).not.toEqual(awayRecipe.schoolTheme);
    expect(playerArtIdentitySignature(homeRecipe)).toBe(
      playerArtIdentitySignature(awayRecipe),
    );
  });
});
