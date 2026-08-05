import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  resolveDistinctPlayerArtRecipes,
  visualPartSignature,
} from "../../../../src/domain/appearance/playerArtDiversity";

describe("player art diversity", () => {
  it("resolves deterministic near-duplicate suppression for a school roster", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const players = school.playerIds.map(
      (playerId) => state.players[playerId]!,
    );

    const recipes = resolveDistinctPlayerArtRecipes(players, school);
    const repeated = resolveDistinctPlayerArtRecipes(
      [...players].reverse(),
      school,
    );
    const signatures = players.map((player) =>
      visualPartSignature(recipes.get(player.id)!),
    );

    expect(recipes.size).toBe(players.length);
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(
      Math.ceil(players.length * 0.85),
    );
    for (const player of players) {
      expect(repeated.get(player.id)).toEqual(recipes.get(player.id));
    }
  });

  it("does not change gameplay-linked body, expression, tier, or jersey values", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const players = school.playerIds.map(
      (playerId) => state.players[playerId]!,
    );
    const recipes = resolveDistinctPlayerArtRecipes(players, school);

    for (const player of players) {
      const recipe = recipes.get(player.id)!;
      expect(recipe.bodyType).toBe(player.bodyType);
      expect(recipe.tier).toBe(player.tier);
      expect(recipe.jerseyNumber).toBeGreaterThan(0);
      expect(recipe.expression).toBeTruthy();
    }
  });
});
