import { createDemoGame } from "../../../../src/app/createDemoGame";
import { createPlayerArtRecipe } from "../../../../src/domain/appearance/playerArtRecipe";
import { resolveGeneratedArtLayers } from "../../../../src/ui/player-art/generatedArtManifest";

function generatedRecipe() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const player = state.players[school.playerIds[1]!]!;
  return createPlayerArtRecipe(player, school);
}

describe("generated art manifest", () => {
  it("resolves a complete ordered WebP layer set", () => {
    const recipe = generatedRecipe();
    const layers = resolveGeneratedArtLayers(recipe);
    const expectedSlots = [
      "hair-back",
      "body",
      "uniform",
      "face",
      "eyes",
      "brows",
      "mouth",
      "hair-front",
    ];

    if (recipe.accessory !== "none") {
      expectedSlots.push("accessory");
    }
    if (recipe.tier !== "normal") {
      expectedSlots.push("effect");
    }

    expect(layers.length).toBeGreaterThanOrEqual(8);
    expect(layers.length).toBeLessThanOrEqual(10);
    expect(
      layers.every((layer) =>
        layer.url.startsWith("data:image/webp;base64,"),
      ),
    ).toBe(true);
    expect(layers.map((layer) => layer.slot)).toEqual(expectedSlots);
    expect(
      layers.every(
        (layer) =>
          layer.sourceRect.width === 64 &&
          layer.sourceRect.height === 96 &&
          layer.sourceRect.atlasWidth === 512 &&
          layer.sourceRect.atlasHeight === 768,
      ),
    ).toBe(true);
  });

  it("assigns school colors only to mask layers", () => {
    const recipe = generatedRecipe();
    const layers = resolveGeneratedArtLayers(recipe);

    expect(layers.filter((layer) => layer.mode === "mask")).not.toHaveLength(0);
    expect(
      layers
        .filter((layer) => layer.mode === "image")
        .every((layer) => layer.color === undefined),
    ).toBe(true);
  });
});
