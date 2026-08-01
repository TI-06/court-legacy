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
  it("resolves a source-quality ordered WebP layer set", () => {
    const recipe = generatedRecipe();
    const layers = resolveGeneratedArtLayers(recipe);
    const expectedSlots = [
      "base",
      "hair-color",
      "uniform-primary",
      "uniform-accent",
    ];

    if (recipe.accessory !== "none") {
      expectedSlots.push("accessory");
    }
    if (recipe.tier !== "normal") {
      expectedSlots.push("effect");
    }

    expect(layers.length).toBeGreaterThanOrEqual(4);
    expect(layers.length).toBeLessThanOrEqual(6);
    expect(layers.every((layer) => layer.url.endsWith(".webp"))).toBe(true);
    expect(layers.map((layer) => layer.slot)).toEqual(expectedSlots);
    expect(
      layers.every(
        (layer) =>
          layer.sourceRect.width === 256 &&
          layer.sourceRect.height === 384 &&
          layer.sourceRect.atlasWidth === 2048 &&
          layer.sourceRect.atlasHeight === 6528,
      ),
    ).toBe(true);
  });

  it("uses color blending only for tint mask layers", () => {
    const recipe = generatedRecipe();
    const layers = resolveGeneratedArtLayers(recipe);
    const tintSlots = new Set([
      "hair-color",
      "uniform-primary",
      "uniform-accent",
    ]);

    expect(
      layers
        .filter((layer) => tintSlots.has(layer.slot))
        .every(
          (layer) =>
            layer.mode === "mask" &&
            layer.color !== undefined &&
            layer.blendMode === "color",
        ),
    ).toBe(true);
    expect(
      layers
        .filter((layer) => layer.mode === "image")
        .every((layer) => layer.color === undefined),
    ).toBe(true);
  });
});
