import allPartsAtlasUrl from "../../assets/player-parts/v1/all-parts-atlas.webp";
import type { PlayerArtRecipe } from "../../domain/appearance/playerArtRecipe";

export type GeneratedArtLayerSlot =
  | "base"
  | "uniform-primary"
  | "uniform-accent"
  | "hair-color"
  | "accessory"
  | "effect";

export interface GeneratedArtSourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
  atlasWidth: number;
  atlasHeight: number;
}

export interface GeneratedArtLayer {
  slot: GeneratedArtLayerSlot;
  url: string;
  sourceRect: GeneratedArtSourceRect;
  mode: "image" | "mask";
  color?: string;
  blendMode?: "color" | "normal";
  opacity?: number;
}

const TILE_WIDTH = 256;
const TILE_HEIGHT = 384;
const ATLAS_COLUMNS = 8;
const ATLAS_WIDTH = 2048;
const ATLAS_HEIGHT = 6528;
const LAYERS_PER_COMBINATION = 4;
const ACCESSORY_START_INDEX = 128;
const EFFECT_START_INDEX = 132;

const HAIR_STYLE_INDEX: Record<PlayerArtRecipe["hairStyle"], number> = {
  buzz: 0,
  "center-part": 1,
  crew: 2,
  curly: 3,
  shaggy: 4,
  "short-spike": 5,
  "side-swept": 6,
  undercut: 7,
};

const BODY_TYPE_INDEX: Record<PlayerArtRecipe["bodyType"], number> = {
  large: 0,
  muscular: 1,
  slim: 2,
  standard: 3,
};

const FACE_SHAPE_INDEX: Record<PlayerArtRecipe["faceShape"], number> = {
  round: 0,
  oval: 1,
  angular: 2,
  wide: 3,
};

const EYE_STYLE_INDEX: Record<PlayerArtRecipe["eyeStyle"], number> = {
  round: 0,
  sharp: 1,
  narrow: 2,
  droop: 3,
};

const BROW_STYLE_INDEX: Record<PlayerArtRecipe["browStyle"], number> = {
  straight: 0,
  arched: 1,
  bold: 2,
  soft: 3,
};

const MOUTH_STYLE_INDEX: Record<PlayerArtRecipe["mouthStyle"], number> = {
  small: 0,
  wide: 1,
  soft: 2,
  firm: 3,
};

const HEIGHT_BAND_INDEX: Record<PlayerArtRecipe["heightBand"], number> = {
  compact: 0,
  average: 1,
  tall: 2,
  towering: 3,
};

const POSE_INDEX: Record<PlayerArtRecipe["pose"], number> = {
  ready: 0,
  upright: 1,
  leaning: 2,
  celebration: 3,
};

const UNIFORM_PATTERN_INDEX: Record<PlayerArtRecipe["uniformPattern"], number> =
  {
    classic: 0,
    "side-stripe": 1,
    chevron: 2,
    split: 3,
  };

const ACCESSORY_INDEX: Record<
  Exclude<PlayerArtRecipe["accessory"], "none">,
  number
> = {
  "ear-tape": ACCESSORY_START_INDEX,
  headband: ACCESSORY_START_INDEX + 1,
  "sports-glasses": ACCESSORY_START_INDEX + 2,
  wristband: ACCESSORY_START_INDEX + 3,
};

const EFFECT_INDEX: Record<
  Exclude<PlayerArtRecipe["tier"], "normal">,
  number
> = {
  generational: EFFECT_START_INDEX,
  prospect: EFFECT_START_INDEX + 1,
};

const HAIR_COLORS: Record<PlayerArtRecipe["hairColor"], string> = {
  black: "#17191f",
  "blue-black": "#15243a",
  "dark-brown": "#3a2823",
  brown: "#5a3b2b",
};

function sourceRect(entryIndex: number): GeneratedArtSourceRect {
  return {
    x: (entryIndex % ATLAS_COLUMNS) * TILE_WIDTH,
    y: Math.floor(entryIndex / ATLAS_COLUMNS) * TILE_HEIGHT,
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    atlasWidth: ATLAS_WIDTH,
    atlasHeight: ATLAS_HEIGHT,
  };
}

function layer(
  slot: GeneratedArtLayerSlot,
  entryIndex: number,
  mode: GeneratedArtLayer["mode"],
  options: Pick<GeneratedArtLayer, "color" | "blendMode" | "opacity"> = {},
): GeneratedArtLayer {
  return {
    slot,
    url: allPartsAtlasUrl,
    sourceRect: sourceRect(entryIndex),
    mode,
    ...options,
  };
}

function headVariantIndex(recipe: PlayerArtRecipe): number {
  return (
    (HAIR_STYLE_INDEX[recipe.hairStyle] +
      FACE_SHAPE_INDEX[recipe.faceShape] * 3 +
      EYE_STYLE_INDEX[recipe.eyeStyle] * 5 +
      BROW_STYLE_INDEX[recipe.browStyle] * 7 +
      MOUTH_STYLE_INDEX[recipe.mouthStyle] * 11) %
    8
  );
}

function bodyVariantIndex(recipe: PlayerArtRecipe): number {
  return (
    (BODY_TYPE_INDEX[recipe.bodyType] +
      HEIGHT_BAND_INDEX[recipe.heightBand] +
      POSE_INDEX[recipe.pose] * 3 +
      UNIFORM_PATTERN_INDEX[recipe.uniformPattern] * 2) %
    4
  );
}

function combinationStartIndex(recipe: PlayerArtRecipe): number {
  const combinationIndex =
    headVariantIndex(recipe) * 4 + bodyVariantIndex(recipe);
  return combinationIndex * LAYERS_PER_COMBINATION;
}

export function resolveGeneratedArtLayers(
  recipe: PlayerArtRecipe,
): GeneratedArtLayer[] {
  const startIndex = combinationStartIndex(recipe);
  const layers: GeneratedArtLayer[] = [
    layer("base", startIndex, "image"),
    layer("hair-color", startIndex + 1, "mask", {
      color: HAIR_COLORS[recipe.hairColor],
      blendMode: "color",
      opacity: 0.88,
    }),
    layer("uniform-primary", startIndex + 2, "mask", {
      color: recipe.schoolTheme.primary,
      blendMode: "color",
      opacity: 0.86,
    }),
    layer("uniform-accent", startIndex + 3, "mask", {
      color: recipe.schoolTheme.accent,
      blendMode: "color",
      opacity: 0.94,
    }),
  ];

  if (recipe.accessory !== "none") {
    layers.push(
      layer("accessory", ACCESSORY_INDEX[recipe.accessory], "mask", {
        color: recipe.schoolTheme.accent,
        blendMode: "normal",
      }),
    );
  }

  if (recipe.tier !== "normal") {
    layers.push(layer("effect", EFFECT_INDEX[recipe.tier], "image"));
  }

  return layers;
}
