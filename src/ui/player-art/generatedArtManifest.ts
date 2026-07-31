import allPartsAtlasUrl from "../../assets/player-parts/v1/all-parts-atlas.webp";
import type { PlayerArtRecipe } from "../../domain/appearance/playerArtRecipe";

export type GeneratedArtLayerSlot =
  | "hair-back"
  | "body"
  | "uniform"
  | "face"
  | "eyes"
  | "brows"
  | "mouth"
  | "hair-front"
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
}

const TILE_WIDTH = 64;
const TILE_HEIGHT = 96;
const ATLAS_WIDTH = 512;
const ATLAS_HEIGHT = 768;

const HAIR_COLORS: Record<PlayerArtRecipe["hairColor"], string> = {
  black: "#17191f",
  "blue-black": "#15243a",
  "dark-brown": "#3a2823",
  brown: "#5a3b2b",
};

const BODY_POSITIONS = {
  ready: {
    large: [0, 0],
    muscular: [64, 0],
    slim: [128, 0],
    standard: [192, 0],
  },
  upright: {
    large: [256, 0],
    muscular: [320, 0],
    slim: [384, 0],
    standard: [448, 0],
  },
  leaning: {
    large: [0, 96],
    muscular: [64, 96],
    slim: [128, 96],
    standard: [192, 96],
  },
  celebration: {
    large: [256, 96],
    muscular: [320, 96],
    slim: [384, 96],
    standard: [448, 96],
  },
} as const;

const FACE_POSITIONS = {
  angular: [0, 192],
  oval: [64, 192],
  round: [128, 192],
  wide: [192, 192],
} as const;

const HAIR_BACK_POSITIONS = {
  buzz: [256, 192],
  "center-part": [320, 192],
  crew: [384, 192],
  curly: [448, 192],
  shaggy: [0, 288],
  "short-spike": [64, 288],
  "side-swept": [128, 288],
  undercut: [192, 288],
} as const;

const HAIR_FRONT_POSITIONS = {
  buzz: [256, 288],
  "center-part": [320, 288],
  crew: [384, 288],
  curly: [448, 288],
  shaggy: [0, 384],
  "short-spike": [64, 384],
  "side-swept": [128, 384],
  undercut: [192, 384],
} as const;

const EYE_POSITIONS = {
  droop: [256, 384],
  narrow: [320, 384],
  round: [384, 384],
  sharp: [448, 384],
} as const;

const BROW_POSITIONS = {
  arched: [0, 480],
  bold: [64, 480],
  soft: [128, 480],
  straight: [192, 480],
} as const;

const MOUTH_POSITIONS = {
  firm: [256, 480],
  small: [320, 480],
  soft: [384, 480],
  wide: [448, 480],
} as const;

const UNIFORM_POSITIONS = {
  chevron: [0, 576],
  classic: [128, 576],
  "side-stripe": [256, 576],
  split: [384, 576],
} as const;

const ACCESSORY_POSITIONS = {
  "ear-tape": [0, 672],
  headband: [64, 672],
  "sports-glasses": [128, 672],
  wristband: [192, 672],
} as const;

const EFFECT_POSITIONS = {
  generational: [256, 672],
  prospect: [320, 672],
} as const;

function sourceRect(
  position: readonly [number, number],
): GeneratedArtSourceRect {
  return {
    x: position[0],
    y: position[1],
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    atlasWidth: ATLAS_WIDTH,
    atlasHeight: ATLAS_HEIGHT,
  };
}

function layer(
  slot: GeneratedArtLayerSlot,
  position: readonly [number, number],
  mode: GeneratedArtLayer["mode"],
  color?: string,
): GeneratedArtLayer {
  return {
    slot,
    url: allPartsAtlasUrl,
    sourceRect: sourceRect(position),
    mode,
    ...(color ? { color } : {}),
  };
}

export function resolveGeneratedArtLayers(
  recipe: PlayerArtRecipe,
): GeneratedArtLayer[] {
  const hairColor = HAIR_COLORS[recipe.hairColor];
  const layers: GeneratedArtLayer[] = [
    layer(
      "hair-back",
      HAIR_BACK_POSITIONS[recipe.hairStyle],
      "mask",
      hairColor,
    ),
    layer("body", BODY_POSITIONS[recipe.pose][recipe.bodyType], "image"),
    layer(
      "uniform",
      UNIFORM_POSITIONS[recipe.uniformPattern],
      "mask",
      recipe.schoolTheme.primary,
    ),
    layer("face", FACE_POSITIONS[recipe.faceShape], "image"),
    layer(
      "eyes",
      EYE_POSITIONS[recipe.eyeStyle],
      "mask",
      recipe.schoolTheme.glow,
    ),
    layer("brows", BROW_POSITIONS[recipe.browStyle], "image"),
    layer("mouth", MOUTH_POSITIONS[recipe.mouthStyle], "image"),
    layer(
      "hair-front",
      HAIR_FRONT_POSITIONS[recipe.hairStyle],
      "mask",
      hairColor,
    ),
  ];

  if (recipe.accessory !== "none") {
    layers.push(
      layer(
        "accessory",
        ACCESSORY_POSITIONS[recipe.accessory],
        "mask",
        recipe.schoolTheme.accent,
      ),
    );
  }

  if (recipe.tier !== "normal") {
    layers.push(layer("effect", EFFECT_POSITIONS[recipe.tier], "image"));
  }

  return layers;
}
