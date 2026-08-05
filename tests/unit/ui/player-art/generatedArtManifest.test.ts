import { createDemoGame } from "../../../../src/app/createDemoGame";
import { createPlayerArtRecipe } from "../../../../src/domain/appearance/playerArtRecipe";
import {
  resolveGeneratedArtLayers,
  type GeneratedArtLayerSlot,
} from "../../../../src/ui/player-art/generatedArtManifest";

function generatedRecipe() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const player = state.players[school.playerIds[1]!]!;
  return createPlayerArtRecipe(player, school);
}

function layerBySlot(
  recipe: ReturnType<typeof generatedRecipe>,
  slot: GeneratedArtLayerSlot,
) {
  const layer = resolveGeneratedArtLayers(recipe).find(
    (candidate) => candidate.slot === slot,
  );
  if (!layer) {
    throw new Error(`generated art must contain ${slot}`);
  }
  return layer;
}

describe("generated art manifest", () => {
  it("resolves independent ordered WebP layers", () => {
    const recipe = generatedRecipe();
    const layers = resolveGeneratedArtLayers(recipe);
    const expectedSlots: GeneratedArtLayerSlot[] = [
      "body",
      "back-hair",
      "skin",
      "face-shadow",
      "uniform-primary",
      "uniform-accent",
      "front-hair",
      "eyes",
      "brows",
      "mouth",
    ];

    if (recipe.accessory !== "none") {
      expectedSlots.push("accessory");
    }
    if (recipe.tier !== "normal") {
      expectedSlots.push("effect");
    }

    expect(layers.length).toBeGreaterThanOrEqual(10);
    expect(layers.length).toBeLessThanOrEqual(12);
    expect(layers.every((layer) => layer.url.endsWith(".webp"))).toBe(true);
    expect(layers.map((layer) => layer.slot)).toEqual(expectedSlots);
    expect(
      layers.every(
        (layer) =>
          layer.sourceRect.width === 256 &&
          layer.sourceRect.height === 384 &&
          layer.sourceRect.atlasWidth === 2048,
      ),
    ).toBe(true);
  });

  it("maps each facial trait to its own source rectangle", () => {
    const recipe = generatedRecipe();
    const variants: Array<{
      slot: GeneratedArtLayerSlot;
      changed: ReturnType<typeof generatedRecipe>;
    }> = [
      {
        slot: "front-hair" as const,
        changed: {
          ...recipe,
          frontHairStyle: recipe.frontHairStyle === "buzz" ? "curly" : "buzz",
        },
      },
      {
        slot: "back-hair" as const,
        changed: {
          ...recipe,
          backHairStyle:
            recipe.backHairStyle === "cropped" ? "layered" : "cropped",
        },
      },
      {
        slot: "eyes" as const,
        changed: {
          ...recipe,
          eyeStyle: recipe.eyeStyle === "round" ? "sharp" : "round",
        },
      },
      {
        slot: "brows" as const,
        changed: {
          ...recipe,
          browStyle: recipe.browStyle === "straight" ? "angled" : "straight",
        },
      },
      {
        slot: "mouth" as const,
        changed: {
          ...recipe,
          mouthStyle: recipe.mouthStyle === "small" ? "grin" : "small",
        },
      },
    ];

    for (const { slot, changed } of variants) {
      expect(layerBySlot(changed, slot).sourceRect).not.toEqual(
        layerBySlot(recipe, slot).sourceRect,
      );
    }
  });

  it("changes expression features without changing player identity layers", () => {
    const recipe = generatedRecipe();
    const changed = {
      ...recipe,
      expression:
        recipe.expression === "neutral"
          ? ("pained" as const)
          : ("neutral" as const),
    };

    for (const slot of ["eyes", "brows", "mouth"] as const) {
      expect(layerBySlot(changed, slot).sourceRect).not.toEqual(
        layerBySlot(recipe, slot).sourceRect,
      );
    }
    for (const slot of [
      "body",
      "skin",
      "back-hair",
      "front-hair",
      "uniform-primary",
      "uniform-accent",
    ] as const) {
      expect(layerBySlot(changed, slot).sourceRect).toEqual(
        layerBySlot(recipe, slot).sourceRect,
      );
    }
  });

  it("uses mask colors only for tintable layers", () => {
    const layers = resolveGeneratedArtLayers(generatedRecipe());
    const tintSlots = new Set<GeneratedArtLayerSlot>([
      "back-hair",
      "skin",
      "uniform-primary",
      "uniform-accent",
      "front-hair",
    ]);

    expect(
      layers
        .filter((layer) => tintSlots.has(layer.slot))
        .every((layer) => layer.mode === "mask" && layer.color !== undefined),
    ).toBe(true);
    expect(
      layers
        .filter((layer) => layer.mode === "image")
        .every((layer) => layer.color === undefined),
    ).toBe(true);
  });
});
