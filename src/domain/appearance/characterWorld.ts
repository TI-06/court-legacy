import type { Player } from "../model/Player";
import type { School, UniformColors } from "../model/School";
import {
  assemblePlayerAppearance,
  type CharacterPose,
  type PlayerAppearance,
  type UniformPattern,
} from "./playerAppearance";

export type SchoolMotif = "wave" | "wing" | "fortress" | "mist" | "shield";

export interface SchoolVisualTheme {
  motif: SchoolMotif;
  primary: string;
  secondary: string;
  accent: string;
  ink: string;
  glow: string;
}

export interface FeaturedCharacterVisual {
  characterId: string;
  jerseyNumber: number;
  roleLabel: string;
  hairColor: string;
  hairAccent: string;
  eyeColor: string;
  skinShadow: string;
  uniformPattern: UniformPattern;
  signaturePose: CharacterPose;
}

export interface CharacterVisual extends FeaturedCharacterVisual {
  featured: boolean;
  schoolMotif: SchoolMotif;
  appearance: PlayerAppearance;
  theme: SchoolVisualTheme;
}

interface FeaturedCharacterEntry extends FeaturedCharacterVisual {
  fullName: string;
  schoolName: string;
}

const FEATURED_CHARACTERS: readonly FeaturedCharacterEntry[] = [
  {
    fullName: "瀬戸 蒼真",
    schoolName: "青嵐高校",
    characterId: "seto-soma",
    jerseyNumber: 7,
    roleLabel: "司令塔",
    hairColor: "#101A30",
    hairAccent: "#24466C",
    eyeColor: "#79C7E8",
    skinShadow: "#D79D86",
    uniformPattern: "side-stripe",
    signaturePose: "ready",
  },
  {
    fullName: "黒羽 隼斗",
    schoolName: "烏峰高校",
    characterId: "kuroba-hayato",
    jerseyNumber: 10,
    roleLabel: "閃光のエース",
    hairColor: "#18191E",
    hairAccent: "#F17819",
    eyeColor: "#D98A35",
    skinShadow: "#D59575",
    uniformPattern: "split",
    signaturePose: "celebration",
  },
  {
    fullName: "火神 蓮",
    schoolName: "紅耀高校",
    characterId: "higami-ren",
    jerseyNumber: 1,
    roleLabel: "赤き砲台",
    hairColor: "#681E2C",
    hairAccent: "#B9424E",
    eyeColor: "#A63D32",
    skinShadow: "#C98672",
    uniformPattern: "chevron",
    signaturePose: "upright",
  },
  {
    fullName: "白間 湊",
    schoolName: "白凪高校",
    characterId: "shiroma-minato",
    jerseyNumber: 13,
    roleLabel: "守備職人",
    hairColor: "#DDE8F0",
    hairAccent: "#8FC5DE",
    eyeColor: "#65B5DB",
    skinShadow: "#DCA68E",
    uniformPattern: "classic",
    signaturePose: "ready",
  },
] as const;

const SCHOOL_THEMES: Readonly<
  Record<string, Omit<SchoolVisualTheme, keyof UniformColors>>
> = {
  青嵐高校: {
    motif: "wave",
    ink: "#0D223B",
    glow: "#91E2EA",
  },
  烏峰高校: {
    motif: "wing",
    ink: "#0F1116",
    glow: "#FFB25F",
  },
  紅耀高校: {
    motif: "fortress",
    ink: "#21171B",
    glow: "#E86C76",
  },
  白凪高校: {
    motif: "mist",
    ink: "#18354D",
    glow: "#BDEBFF",
  },
};

const HAIR_COLOR_HEX: Record<PlayerAppearance["hairColor"], string> = {
  black: "#17191F",
  "blue-black": "#15243A",
  "dark-brown": "#3A2823",
  brown: "#5A3B2B",
};

const DEFAULT_UNIFORM: UniformColors = {
  primary: "#23384A",
  secondary: "#F4F6F7",
  accent: "#CF8C32",
};

function fullName(player: Player): string {
  return `${player.lastName} ${player.firstName}`;
}

export function resolveFeaturedCharacter(
  player: Player,
  school?: School | null,
): FeaturedCharacterVisual | null {
  const playerName = fullName(player);
  const entry = FEATURED_CHARACTERS.find(
    (candidate) =>
      candidate.fullName === playerName &&
      (school === undefined ||
        school === null ||
        candidate.schoolName === school.name),
  );

  if (!entry) {
    return null;
  }

  return {
    characterId: entry.characterId,
    jerseyNumber: entry.jerseyNumber,
    roleLabel: entry.roleLabel,
    hairColor: entry.hairColor,
    hairAccent: entry.hairAccent,
    eyeColor: entry.eyeColor,
    skinShadow: entry.skinShadow,
    uniformPattern: entry.uniformPattern,
    signaturePose: entry.signaturePose,
  };
}

export function resolveSchoolVisualTheme(
  school?: School | null,
): SchoolVisualTheme {
  const uniform = school?.uniform ?? DEFAULT_UNIFORM;
  const configured = school ? SCHOOL_THEMES[school.name] : undefined;

  return {
    motif: configured?.motif ?? "shield",
    primary: uniform.primary,
    secondary: uniform.secondary,
    accent: uniform.accent,
    ink: configured?.ink ?? uniform.primary,
    glow: configured?.glow ?? uniform.accent,
  };
}

export function resolveJerseyNumber(player: Player): number {
  const featured = resolveFeaturedCharacter(player);
  if (featured) {
    return featured.jerseyNumber;
  }

  return 1 + (Math.abs(player.appearanceSeed) % 18);
}

export function resolveCharacterVisual(
  player: Player,
  school?: School | null,
): CharacterVisual {
  const appearance = assemblePlayerAppearance(player);
  const theme = resolveSchoolVisualTheme(school);
  const featured = resolveFeaturedCharacter(player, school);

  if (featured) {
    return {
      ...featured,
      featured: true,
      schoolMotif: theme.motif,
      appearance: {
        ...appearance,
        uniformPattern: featured.uniformPattern,
        pose: featured.signaturePose,
      },
      theme,
    };
  }

  return {
    characterId: `generated-${player.appearanceSeed}`,
    jerseyNumber: resolveJerseyNumber(player),
    roleLabel: player.preferredPosition,
    hairColor: HAIR_COLOR_HEX[appearance.hairColor],
    hairAccent: theme.accent,
    eyeColor: theme.glow,
    skinShadow: "#D49A82",
    uniformPattern: appearance.uniformPattern,
    signaturePose: appearance.pose,
    featured: false,
    schoolMotif: theme.motif,
    appearance,
    theme,
  };
}
