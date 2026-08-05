import accessoryAtlasUrl from "../../assets/player-parts/v2/accessory-atlas.webp";
import backHairAtlasUrl from "../../assets/player-parts/v2/back-hair-atlas.webp";
import bodyAtlasUrl from "../../assets/player-parts/v2/body-atlas.webp";
import browsAtlasUrl from "../../assets/player-parts/v2/brows-atlas.webp";
import effectAtlasUrl from "../../assets/player-parts/v2/effect-atlas.webp";
import eyesAtlasUrl from "../../assets/player-parts/v2/eyes-atlas.webp";
import faceShadowAtlasUrl from "../../assets/player-parts/v2/face-shadow-atlas.webp";
import frontHairAtlasUrl from "../../assets/player-parts/v2/front-hair-atlas.webp";
import mouthsAtlasUrl from "../../assets/player-parts/v2/mouths-atlas.webp";
import skinAtlasUrl from "../../assets/player-parts/v2/skin-atlas.webp";
import uniformAtlasUrl from "../../assets/player-parts/v2/uniform-atlas.webp";
import type { PlayerArtRecipe } from "../../domain/appearance/playerArtRecipe";

export const GENERATED_ART_CATALOG_VERSION = 2 as const;
export const ATLAS_TILE = { width: 256, height: 384 } as const;
export const REQUIRED_GENERATED_ART_ATLASES = [
  bodyAtlasUrl,
  skinAtlasUrl,
  faceShadowAtlasUrl,
  backHairAtlasUrl,
  frontHairAtlasUrl,
  eyesAtlasUrl,
  browsAtlasUrl,
  mouthsAtlasUrl,
  uniformAtlasUrl,
  accessoryAtlasUrl,
  effectAtlasUrl,
] as const;

export type GeneratedArtLayerSlot =
  | "body"
  | "back-hair"
  | "skin"
  | "face-shadow"
  | "uniform-primary"
  | "uniform-accent"
  | "front-hair"
  | "eyes"
  | "brows"
  | "mouth"
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

const ATLAS_COLUMNS = 8;
const ATLAS_WIDTH = ATLAS_COLUMNS * ATLAS_TILE.width;

const ATLAS_HEIGHTS = {
  body: 768,
  skin: 768,
  faceShadow: 384,
  backHair: 384,
  frontHair: 384,
  eyes: 1152,
  brows: 1152,
  mouths: 1152,
  uniform: 1536,
  accessory: 768,
  effect: 384,
} as const;

const BODY_TYPE_INDEX: Record<PlayerArtRecipe["bodyType"], number> = {
  slim: 0,
  standard: 1,
  muscular: 2,
  large: 3,
};

const POSE_INDEX: Record<PlayerArtRecipe["pose"], number> = {
  ready: 0,
  upright: 1,
  leaning: 2,
  celebration: 3,
};

const FACE_SHAPE_INDEX: Record<PlayerArtRecipe["faceShape"], number> = {
  round: 0,
  oval: 1,
  angular: 2,
  wide: 3,
};

const FRONT_HAIR_INDEX: Record<PlayerArtRecipe["frontHairStyle"], number> = {
  "short-spike": 0,
  "side-swept": 1,
  buzz: 2,
  curly: 3,
  "center-part": 4,
  shaggy: 5,
  undercut: 6,
  crew: 7,
};

const BACK_HAIR_INDEX: Record<PlayerArtRecipe["backHairStyle"], number> = {
  cropped: 0,
  rounded: 1,
  layered: 2,
  tapered: 3,
  "long-nape": 4,
  "undercut-back": 5,
};

const EYE_STYLE_INDEX: Record<PlayerArtRecipe["eyeStyle"], number> = {
  round: 0,
  sharp: 1,
  narrow: 2,
  droop: 3,
  bright: 4,
  "deep-set": 5,
};

const BROW_STYLE_INDEX: Record<PlayerArtRecipe["browStyle"], number> = {
  straight: 0,
  arched: 1,
  bold: 2,
  soft: 3,
  angled: 4,
};

const MOUTH_STYLE_INDEX: Record<PlayerArtRecipe["mouthStyle"], number> = {
  small: 0,
  wide: 1,
  soft: 2,
  firm: 3,
  grin: 4,
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
  "ear-tape": 0,
  headband: 1,
  "sports-glasses": 2,
  wristband: 3,
};

const EFFECT_INDEX: Record<
  Exclude<PlayerArtRecipe["tier"], "normal">,
  number
> = {
  generational: 0,
  prospect: 1,
};

const HAIR_COLORS: Record<PlayerArtRecipe["hairColor"], string> = {
  black: "#17191f",
  "blue-black": "#15243a",
  "dark-brown": "#3a2823",
  brown: "#5a3b2b",
};

const SKIN_COLORS: Record<PlayerArtRecipe["skinTone"], string> = {
  fair: "#f6d1b6",
  light: "#eabf9e",
  medium: "#d79c75",
  tan: "#b86e48",
  deep: "#805039",
};

type VisualExpression = "neutral" | "focused" | "joy" | "frustrated";

const VISUAL_EXPRESSION_INDEX: Record<VisualExpression, number> = {
  neutral: 0,
  focused: 1,
  joy: 2,
  frustrated: 3,
};

function visualExpressionFor(
  expression: PlayerArtRecipe["expression"],
): VisualExpression {
  switch (expression) {
    case "focused":
      return "focused";
    case "confident":
      return "joy";
    case "tired":
    case "exhausted":
    case "worried":
    case "pained":
      return "frustrated";
    case "neutral":
    default:
      return "neutral";
  }
}

function sourceRect(
  entryIndex: number,
  atlasHeight: number,
): GeneratedArtSourceRect {
  return {
    x: (entryIndex % ATLAS_COLUMNS) * ATLAS_TILE.width,
    y: Math.floor(entryIndex / ATLAS_COLUMNS) * ATLAS_TILE.height,
    width: ATLAS_TILE.width,
    height: ATLAS_TILE.height,
    atlasWidth: ATLAS_WIDTH,
    atlasHeight,
  };
}

function layer(
  slot: GeneratedArtLayerSlot,
  url: string,
  entryIndex: number,
  atlasHeight: number,
  mode: GeneratedArtLayer["mode"],
  options: Pick<GeneratedArtLayer, "color" | "blendMode" | "opacity"> = {},
): GeneratedArtLayer {
  return {
    slot,
    url,
    sourceRect: sourceRect(entryIndex, atlasHeight),
    mode,
    ...options,
  };
}

export function resolveGeneratedArtLayers(
  recipe: PlayerArtRecipe,
): GeneratedArtLayer[] {
  const bodyIndex = BODY_TYPE_INDEX[recipe.bodyType];
  const poseIndex = POSE_INDEX[recipe.pose];
  const faceIndex = FACE_SHAPE_INDEX[recipe.faceShape];
  const expressionIndex =
    VISUAL_EXPRESSION_INDEX[visualExpressionFor(recipe.expression)];
  const uniformIndex =
    bodyIndex * 4 + UNIFORM_PATTERN_INDEX[recipe.uniformPattern];

  const layers: GeneratedArtLayer[] = [
    layer(
      "body",
      bodyAtlasUrl,
      poseIndex * 4 + bodyIndex,
      ATLAS_HEIGHTS.body,
      "image",
    ),
    layer(
      "back-hair",
      backHairAtlasUrl,
      BACK_HAIR_INDEX[recipe.backHairStyle],
      ATLAS_HEIGHTS.backHair,
      "mask",
      { color: HAIR_COLORS[recipe.hairColor] },
    ),
    layer(
      "skin",
      skinAtlasUrl,
      poseIndex * 4 + faceIndex,
      ATLAS_HEIGHTS.skin,
      "mask",
      { color: SKIN_COLORS[recipe.skinTone] },
    ),
    layer(
      "face-shadow",
      faceShadowAtlasUrl,
      faceIndex,
      ATLAS_HEIGHTS.faceShadow,
      "image",
    ),
    layer(
      "uniform-primary",
      uniformAtlasUrl,
      uniformIndex,
      ATLAS_HEIGHTS.uniform,
      "mask",
      { color: recipe.schoolTheme.primary },
    ),
    layer(
      "uniform-accent",
      uniformAtlasUrl,
      uniformIndex + 16,
      ATLAS_HEIGHTS.uniform,
      "mask",
      { color: recipe.schoolTheme.accent },
    ),
    layer(
      "front-hair",
      frontHairAtlasUrl,
      FRONT_HAIR_INDEX[recipe.frontHairStyle],
      ATLAS_HEIGHTS.frontHair,
      "mask",
      { color: HAIR_COLORS[recipe.hairColor] },
    ),
    layer(
      "eyes",
      eyesAtlasUrl,
      expressionIndex * 6 + EYE_STYLE_INDEX[recipe.eyeStyle],
      ATLAS_HEIGHTS.eyes,
      "image",
    ),
    layer(
      "brows",
      browsAtlasUrl,
      expressionIndex * 5 + BROW_STYLE_INDEX[recipe.browStyle],
      ATLAS_HEIGHTS.brows,
      "image",
    ),
    layer(
      "mouth",
      mouthsAtlasUrl,
      expressionIndex * 5 + MOUTH_STYLE_INDEX[recipe.mouthStyle],
      ATLAS_HEIGHTS.mouths,
      "image",
    ),
  ];

  if (recipe.accessory !== "none") {
    const accessoryIndex = ACCESSORY_INDEX[recipe.accessory];
    const isSportsGlasses = recipe.accessory === "sports-glasses";
    layers.push(
      layer(
        "accessory",
        accessoryAtlasUrl,
        poseIndex * 4 + accessoryIndex,
        ATLAS_HEIGHTS.accessory,
        isSportsGlasses ? "image" : "mask",
        isSportsGlasses ? {} : { color: recipe.schoolTheme.accent },
      ),
    );
  }

  if (recipe.tier !== "normal") {
    layers.push(
      layer(
        "effect",
        effectAtlasUrl,
        EFFECT_INDEX[recipe.tier],
        ATLAS_HEIGHTS.effect,
        "image",
      ),
    );
  }

  return layers;
}
