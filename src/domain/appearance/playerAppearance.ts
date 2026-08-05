import type { BodyType, Player, PlayerTier, Position } from "../model/Player";

export type HeightBand = "compact" | "average" | "tall" | "towering";
export type FaceShape = "round" | "oval" | "angular" | "wide";
export type EyeStyle =
  "round" | "sharp" | "narrow" | "droop" | "bright" | "deep-set";
export type BrowStyle = "straight" | "arched" | "bold" | "soft" | "angled";
export type MouthStyle = "small" | "wide" | "soft" | "firm" | "grin";
export type FrontHairStyle =
  | "short-spike"
  | "side-swept"
  | "buzz"
  | "curly"
  | "center-part"
  | "shaggy"
  | "undercut"
  | "crew";
export type BackHairStyle =
  "cropped" | "rounded" | "layered" | "tapered" | "long-nape" | "undercut-back";
export type HairStyle = FrontHairStyle;
export type HairColor = "black" | "blue-black" | "dark-brown" | "brown";
export type SkinTone = "fair" | "light" | "medium" | "tan" | "deep";
export type AccessoryStyle =
  "none" | "headband" | "sports-glasses" | "ear-tape" | "wristband";
export type UniformPattern = "classic" | "side-stripe" | "chevron" | "split";
export type CharacterPose = "ready" | "upright" | "leaning" | "celebration";
export type CharacterExpression =
  | "neutral"
  | "focused"
  | "confident"
  | "tired"
  | "exhausted"
  | "worried"
  | "pained";

export interface PlayerAppearance {
  appearanceSeed: number;
  heightBand: HeightBand;
  bodyType: BodyType;
  faceShape: FaceShape;
  eyeStyle: EyeStyle;
  browStyle: BrowStyle;
  mouthStyle: MouthStyle;
  frontHairStyle: FrontHairStyle;
  backHairStyle: BackHairStyle;
  /** Compatibility alias used by the v1 renderer while v2 assets are wired. */
  hairStyle: HairStyle;
  hairColor: HairColor;
  skinTone: SkinTone;
  accessory: AccessoryStyle;
  uniformPattern: UniformPattern;
  pose: CharacterPose;
  expression: CharacterExpression;
  position: Position;
  tier: PlayerTier;
}

const FACE_SHAPES = ["round", "oval", "angular", "wide"] as const;
const EYE_STYLES = [
  "round",
  "sharp",
  "narrow",
  "droop",
  "bright",
  "deep-set",
] as const;
const BROW_STYLES = ["straight", "arched", "bold", "soft", "angled"] as const;
const MOUTH_STYLES = ["small", "wide", "soft", "firm", "grin"] as const;
const FRONT_HAIR_STYLES = [
  "short-spike",
  "side-swept",
  "buzz",
  "curly",
  "center-part",
  "shaggy",
  "undercut",
  "crew",
] as const;
const BACK_HAIR_STYLES = [
  "cropped",
  "rounded",
  "layered",
  "tapered",
  "long-nape",
  "undercut-back",
] as const;
const HAIR_COLORS = ["black", "blue-black", "dark-brown", "brown"] as const;
const SKIN_TONES = ["fair", "light", "medium", "tan", "deep"] as const;
const ACCESSORIES = [
  "none",
  "headband",
  "sports-glasses",
  "ear-tape",
  "wristband",
] as const;
const UNIFORM_PATTERNS = [
  "classic",
  "side-stripe",
  "chevron",
  "split",
] as const;
const POSES = ["ready", "upright", "leaning", "celebration"] as const;

function mixedValue(seed: number, salt: number): number {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}

function pick<T>(seed: number, salt: number, values: readonly T[]): T {
  const selected = values[mixedValue(seed, salt) % values.length];
  if (selected === undefined) {
    throw new Error("appearance catalog must not be empty");
  }
  return selected;
}

export function heightBandFor(heightCm: number): HeightBand {
  if (heightCm <= 172) {
    return "compact";
  }
  if (heightCm <= 184) {
    return "average";
  }
  if (heightCm <= 194) {
    return "tall";
  }
  return "towering";
}

function expressionFor(player: Player): CharacterExpression {
  if (player.injury) {
    return "pained";
  }
  if (player.fatigue >= 85) {
    return "exhausted";
  }
  if (player.condition <= 40) {
    return "worried";
  }
  if (player.morale >= 78) {
    return "confident";
  }
  if (player.fatigue >= 60) {
    return "tired";
  }
  return mixedValue(player.appearanceSeed, 31) % 2 === 0
    ? "focused"
    : "neutral";
}

function poseFor(player: Player): CharacterPose {
  const value = mixedValue(player.appearanceSeed, 29);

  if (player.preferredPosition === "L" || player.preferredPosition === "S") {
    return value % 3 === 0 ? "upright" : "ready";
  }
  if (player.preferredPosition === "MB") {
    return value % 3 === 0 ? "ready" : "upright";
  }
  return POSES[value % POSES.length] ?? "ready";
}

export function seedAppearanceSignature(seed: number): string {
  return [
    pick(seed, 1, FACE_SHAPES),
    pick(seed, 3, EYE_STYLES),
    pick(seed, 5, BROW_STYLES),
    pick(seed, 7, MOUTH_STYLES),
    pick(seed, 11, FRONT_HAIR_STYLES),
    pick(seed, 12, BACK_HAIR_STYLES),
    pick(seed, 13, HAIR_COLORS),
    pick(seed, 17, SKIN_TONES),
    pick(seed, 19, ACCESSORIES),
    pick(seed, 23, UNIFORM_PATTERNS),
  ].join("|");
}

export function assemblePlayerAppearance(player: Player): PlayerAppearance {
  const frontHairStyle = pick(player.appearanceSeed, 11, FRONT_HAIR_STYLES);

  return {
    appearanceSeed: player.appearanceSeed,
    heightBand: heightBandFor(player.heightCm),
    bodyType: player.bodyType,
    faceShape: pick(player.appearanceSeed, 1, FACE_SHAPES),
    eyeStyle: pick(player.appearanceSeed, 3, EYE_STYLES),
    browStyle: pick(player.appearanceSeed, 5, BROW_STYLES),
    mouthStyle: pick(player.appearanceSeed, 7, MOUTH_STYLES),
    frontHairStyle,
    backHairStyle: pick(player.appearanceSeed, 12, BACK_HAIR_STYLES),
    hairStyle: frontHairStyle,
    hairColor: pick(player.appearanceSeed, 13, HAIR_COLORS),
    skinTone: pick(player.appearanceSeed, 17, SKIN_TONES),
    accessory: pick(player.appearanceSeed, 19, ACCESSORIES),
    uniformPattern: pick(player.appearanceSeed, 23, UNIFORM_PATTERNS),
    pose: poseFor(player),
    expression: expressionFor(player),
    position: player.preferredPosition,
    tier: player.tier,
  };
}

export function appearanceSignature(appearance: PlayerAppearance): string {
  return [
    appearance.heightBand,
    appearance.bodyType,
    appearance.faceShape,
    appearance.eyeStyle,
    appearance.browStyle,
    appearance.mouthStyle,
    appearance.frontHairStyle,
    appearance.backHairStyle,
    appearance.hairColor,
    appearance.skinTone,
    appearance.accessory,
    appearance.uniformPattern,
    appearance.pose,
  ].join("|");
}
