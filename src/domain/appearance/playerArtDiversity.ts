import type { Player } from "../model/Player";
import type { School } from "../model/School";
import { createPlayerArtRecipe, type PlayerArtRecipe } from "./playerArtRecipe";
import type {
  AccessoryStyle,
  BackHairStyle,
  BrowStyle,
  CharacterPose,
  EyeStyle,
  FrontHairStyle,
  MouthStyle,
  UniformPattern,
} from "./playerAppearance";

const FRONT_HAIR_STYLES: readonly FrontHairStyle[] = [
  "short-spike",
  "side-swept",
  "buzz",
  "curly",
  "center-part",
  "shaggy",
  "undercut",
  "crew",
];
const BACK_HAIR_STYLES: readonly BackHairStyle[] = [
  "cropped",
  "rounded",
  "layered",
  "tapered",
  "long-nape",
  "undercut-back",
];
const EYE_STYLES: readonly EyeStyle[] = [
  "round",
  "sharp",
  "narrow",
  "droop",
  "bright",
  "deep-set",
];
const BROW_STYLES: readonly BrowStyle[] = [
  "straight",
  "arched",
  "bold",
  "soft",
  "angled",
];
const MOUTH_STYLES: readonly MouthStyle[] = [
  "small",
  "wide",
  "soft",
  "firm",
  "grin",
];
const ACCESSORIES: readonly AccessoryStyle[] = [
  "none",
  "headband",
  "sports-glasses",
  "ear-tape",
  "wristband",
];
const UNIFORM_PATTERNS: readonly UniformPattern[] = [
  "classic",
  "side-stripe",
  "chevron",
  "split",
];
const POSES: readonly CharacterPose[] = [
  "ready",
  "upright",
  "leaning",
  "celebration",
];

function rotate<T>(values: readonly T[], current: T, offset: number): T {
  const currentIndex = Math.max(0, values.indexOf(current));
  const selected = values[(currentIndex + offset) % values.length];
  if (selected === undefined) {
    throw new Error("player art diversity catalog must not be empty");
  }
  return selected;
}

function variedRecipe(base: PlayerArtRecipe, attempt: number): PlayerArtRecipe {
  if (attempt === 0) {
    return base;
  }

  const frontHairStyle = rotate(
    FRONT_HAIR_STYLES,
    base.frontHairStyle,
    attempt,
  );
  return {
    ...base,
    variationSalt: (base.variationSalt + attempt) >>> 0,
    frontHairStyle,
    hairStyle: frontHairStyle,
    backHairStyle: rotate(BACK_HAIR_STYLES, base.backHairStyle, attempt * 3),
    eyeStyle: rotate(EYE_STYLES, base.eyeStyle, attempt * 5),
    browStyle: rotate(BROW_STYLES, base.browStyle, attempt * 7),
    mouthStyle: rotate(MOUTH_STYLES, base.mouthStyle, attempt * 11),
    accessory: rotate(ACCESSORIES, base.accessory, attempt * 13),
    uniformPattern: rotate(UNIFORM_PATTERNS, base.uniformPattern, attempt * 17),
    pose: rotate(POSES, base.pose, attempt * 19),
  };
}

export function visualPartSignature(recipe: PlayerArtRecipe): string {
  return [
    recipe.heightBand,
    recipe.bodyType,
    recipe.faceShape,
    recipe.eyeStyle,
    recipe.browStyle,
    recipe.mouthStyle,
    recipe.frontHairStyle,
    recipe.backHairStyle,
    recipe.hairColor,
    recipe.skinTone,
    recipe.accessory,
    recipe.uniformPattern,
    recipe.pose,
  ].join("|");
}

export function resolveDistinctPlayerArtRecipes(
  players: readonly Player[],
  school?: School | null,
): Map<string, PlayerArtRecipe> {
  const recipes = new Map<string, PlayerArtRecipe>();
  const usedSignatures = new Set<string>();
  const sortedPlayers = [...players].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  for (const player of sortedPlayers) {
    const base = createPlayerArtRecipe(player, school);
    let selected = base;

    for (let attempt = 0; attempt <= 15; attempt += 1) {
      const candidate = variedRecipe(base, attempt);
      if (!usedSignatures.has(visualPartSignature(candidate))) {
        selected = candidate;
        break;
      }
    }

    usedSignatures.add(visualPartSignature(selected));
    recipes.set(player.id, selected);
  }

  return recipes;
}
