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
  type BrowStyle,
  type CharacterExpression,
  type CharacterPose,
  type EyeStyle,
  type FaceShape,
  type HairColor,
  type HairStyle,
  type HeightBand,
  type MouthStyle,
  type SkinTone,
  type UniformPattern,
} from "./playerAppearance";

export type PlayerArtVariant = "card" | "portrait" | "full";

export interface PlayerArtRecipe {
  catalogVersion: 1;
  appearanceSeed: number;
  jerseyNumber: number;
  heightBand: HeightBand;
  bodyType: BodyType;
  faceShape: FaceShape;
  eyeStyle: EyeStyle;
  browStyle: BrowStyle;
  mouthStyle: MouthStyle;
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

export function createPlayerArtRecipe(
  player: Player,
  school?: School | null,
): PlayerArtRecipe {
  const appearance = assemblePlayerAppearance(player);

  return {
    catalogVersion: 1,
    appearanceSeed: appearance.appearanceSeed,
    jerseyNumber: resolveJerseyNumber(player),
    heightBand: appearance.heightBand,
    bodyType: appearance.bodyType,
    faceShape: appearance.faceShape,
    eyeStyle: appearance.eyeStyle,
    browStyle: appearance.browStyle,
    mouthStyle: appearance.mouthStyle,
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
    recipe.hairStyle,
    recipe.hairColor,
    recipe.skinTone,
    recipe.accessory,
    recipe.uniformPattern,
    recipe.pose,
  ].join("|");
}
