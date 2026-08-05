import type { BodyType, Player, PlayerTier } from "../model/Player";
import type { School } from "../model/School";
import {
  resolveJerseyNumber,
  resolveSchoolVisualTheme,
  type SchoolVisualTheme,
} from "./characterWorld";
import {
  assemblePlayerAppearance,
  type AccessoryStyle,
  type BackHairStyle,
  type BrowStyle,
  type CharacterExpression,
  type CharacterPose,
  type EyeStyle,
  type FaceShape,
  type FrontHairStyle,
  type HairColor,
  type HairStyle,
  type HeightBand,
  type MouthStyle,
  type SkinTone,
  type UniformPattern,
} from "./playerAppearance";

export type PlayerArtVariant = "card" | "portrait" | "full";

export interface PlayerArtRecipe {
  catalogVersion: 2;
  appearanceSeed: number;
  variationSalt: number;
  jerseyNumber: number;
  heightBand: HeightBand;
  bodyType: BodyType;
  faceShape: FaceShape;
  eyeStyle: EyeStyle;
  browStyle: BrowStyle;
  mouthStyle: MouthStyle;
  frontHairStyle: FrontHairStyle;
  backHairStyle: BackHairStyle;
  /** Compatibility alias for the v1 atlas resolver. */
  hairStyle: HairStyle;
  hairColor: HairColor;
  skinTone: SkinTone;
  accessory: AccessoryStyle;
  uniformPattern: UniformPattern;
  pose: CharacterPose;
  expression: CharacterExpression;
  tier: PlayerTier;
  schoolTheme: SchoolVisualTheme;
}

function stableStringHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function playerVariationSalt(player: Player): number {
  return stableStringHash(`${player.id}:${player.appearanceSeed}`);
}

export function createPlayerArtRecipe(
  player: Player,
  school?: School | null,
  variationSalt = playerVariationSalt(player),
): PlayerArtRecipe {
  const appearance = assemblePlayerAppearance(player);

  return {
    catalogVersion: 2,
    appearanceSeed: appearance.appearanceSeed,
    variationSalt: variationSalt >>> 0,
    jerseyNumber: resolveJerseyNumber(player),
    heightBand: appearance.heightBand,
    bodyType: appearance.bodyType,
    faceShape: appearance.faceShape,
    eyeStyle: appearance.eyeStyle,
    browStyle: appearance.browStyle,
    mouthStyle: appearance.mouthStyle,
    frontHairStyle: appearance.frontHairStyle,
    backHairStyle: appearance.backHairStyle,
    hairStyle: appearance.hairStyle,
    hairColor: appearance.hairColor,
    skinTone: appearance.skinTone,
    accessory: appearance.accessory,
    uniformPattern: appearance.uniformPattern,
    pose: appearance.pose,
    expression: appearance.expression,
    tier: appearance.tier,
    schoolTheme: resolveSchoolVisualTheme(school),
  };
}

export function playerArtIdentitySignature(recipe: PlayerArtRecipe): string {
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
