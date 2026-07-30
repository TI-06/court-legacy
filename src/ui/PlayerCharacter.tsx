import type { ReactNode } from "react";
import { resolveCharacterVisual } from "../domain/appearance/characterWorld";
import type {
  AccessoryStyle,
  BrowStyle,
  CharacterExpression,
  EyeStyle,
  FaceShape,
  HairStyle,
  MouthStyle,
  PlayerAppearance,
  SkinTone,
  UniformPattern,
} from "../domain/appearance/playerAppearance";
import type { Player } from "../domain/model/Player";
import type { School, UniformColors } from "../domain/model/School";
import { SchoolEmblem } from "./SchoolEmblem";

const DEFAULT_CHARACTER_UNIFORM: UniformColors = {
  primary: "#1A5364",
  secondary: "#F4F7F8",
  accent: "#D89A2B",
};

interface PlayerCharacterProps {
  player: Player;
  school?: School | null;
  uniform?: UniformColors;
  variant?: "chibi" | "portrait";
  className?: string;
}

const SKIN_COLORS: Record<SkinTone, string> = {
  fair: "#F3C9AA",
  light: "#E8B68F",
  medium: "#D39A70",
  tan: "#B87951",
  deep: "#855438",
};

const BODY_HALF_WIDTH = {
  slim: 10.5,
  standard: 12.5,
  muscular: 15,
  large: 16.5,
} as const;

const HEIGHT_OFFSET = {
  compact: 3,
  average: 1.5,
  tall: 0,
  towering: -2,
} as const;

function face(shape: FaceShape, skinColor: string, shadowColor: string) {
  const dimensions =
    shape === "round"
      ? { rx: 15, ry: 16 }
      : shape === "wide"
        ? { rx: 16, ry: 14.5 }
        : shape === "angular"
          ? { rx: 13.5, ry: 17.5 }
          : { rx: 13.5, ry: 17 };

  return (
    <g>
      <ellipse
        cx="40"
        cy="26"
        fill={skinColor}
        rx={dimensions.rx}
        ry={dimensions.ry}
      />
      <path
        d="M40 10c8 0 13 6 13 16 0 8-4 13-13 17 5-5 7-10 7-17 0-8-2-13-7-16Z"
        fill={shadowColor}
        opacity="0.22"
      />
      <path
        d="M39 25 37.8 30.2 41 31"
        fill="none"
        opacity="0.55"
        stroke={shadowColor}
        strokeLinecap="round"
        strokeWidth="1"
      />
      <path
        d="M29 31c2 1 4 1 6 0M45 31c2 1 4 1 6 0"
        fill="none"
        opacity="0.18"
        stroke="#A85E55"
        strokeLinecap="round"
      />
    </g>
  );
}

function hairShape(style: HairStyle, color: string): ReactNode {
  switch (style) {
    case "short-spike":
      return (
        <path
          d="M24 21 27 10 31 12 35 5 39 11 44 4 47 11 54 7 57 20 52 18 54 27 48 22 45 30 40 22 35 28 32 21 26 27Z"
          fill={color}
        />
      );
    case "side-swept":
      return (
        <path
          d="M23 22Q24 7 40 6q15 1 17 14-9-8-20-5l8 2-16 3-2 9-5-4Z"
          fill={color}
        />
      );
    case "buzz":
      return <path d="M26 18Q28 7 40 7t14 11q-14-6-28 0Z" fill={color} />;
    case "curly":
      return (
        <g fill={color}>
          <circle cx="28" cy="15" r="6" />
          <circle cx="35" cy="10" r="7" />
          <circle cx="43" cy="10" r="7" />
          <circle cx="51" cy="15" r="6" />
          <path d="M24 18q16-8 32 0l-2 7q-14-8-28 0Z" />
        </g>
      );
    case "center-part":
      return (
        <g fill={color}>
          <path d="M24 22Q25 7 39 6l-1 14q-7-5-13 7Z" />
          <path d="M41 6q14 1 15 16l-1 6q-6-13-13-8Z" />
        </g>
      );
    case "shaggy":
      return (
        <path
          d="M23 20Q25 6 40 6t17 14l-3 11-4-6-4 7-4-8-5 6-4-8-5 8-3-7Z"
          fill={color}
        />
      );
    case "undercut":
      return (
        <g fill={color}>
          <path d="M24 20Q27 7 42 6q11 2 14 10-15-5-28 7Z" />
          <path d="m25 19 3 12-5-4Z" opacity="0.68" />
        </g>
      );
    case "crew":
      return (
        <path d="m27 18 2-9 5-2 6-1 7 2 6 4 2 7q-14-6-28-1Z" fill={color} />
      );
  }
}

function hair(
  style: HairStyle,
  color: string,
  accent: string,
  featured: boolean,
) {
  return (
    <g>
      {hairShape(style, color)}
      <path
        d="M30 13q8-7 17-3l-5 2 7 2-12 1 7 3-12-2Z"
        fill={accent}
        opacity={featured ? 0.9 : 0.42}
      />
      <path
        d="M29 11q10-7 20 0"
        fill="none"
        opacity="0.3"
        stroke="#FFFFFF"
        strokeLinecap="round"
      />
    </g>
  );
}

function eyes(
  style: EyeStyle,
  expression: CharacterExpression,
  eyeColor: string,
) {
  const tired = expression === "exhausted" || expression === "tired";
  const pained = expression === "pained";
  const narrow = style === "narrow" || tired;
  const sharp = style === "sharp" || expression === "focused";

  return (
    <g>
      <g
        fill={eyeColor}
        data-testid="player-character-iris"
        opacity={pained ? 0.35 : 1}
      >
        {narrow ? (
          <>
            <ellipse cx="34" cy="25.5" rx="2.5" ry="0.9" />
            <ellipse cx="46" cy="25.5" rx="2.5" ry="0.9" />
          </>
        ) : (
          <>
            <ellipse cx="34" cy="25.5" rx={sharp ? 2.2 : 2.6} ry="2.4" />
            <ellipse cx="46" cy="25.5" rx={sharp ? 2.2 : 2.6} ry="2.4" />
          </>
        )}
      </g>
      <g fill="#15202A">
        <circle cx="34" cy="25.5" r={narrow ? 0.65 : 1.05} />
        <circle cx="46" cy="25.5" r={narrow ? 0.65 : 1.05} />
      </g>
      <g
        fill="none"
        stroke="#202933"
        strokeLinecap="round"
        strokeWidth={sharp ? 1.7 : 1.35}
      >
        <path d={pained ? "M30 27 37 23" : "M30 24q4-2 8 0"} />
        <path d={pained ? "M43 23 50 27" : "M42 24q4-2 8 0"} />
      </g>
    </g>
  );
}

function brows(style: BrowStyle, expression: CharacterExpression) {
  const width = style === "bold" ? 2.4 : style === "soft" ? 1.2 : 1.65;
  const worried = expression === "worried" || expression === "pained";
  return (
    <g fill="none" stroke="#3B2925" strokeLinecap="round" strokeWidth={width}>
      <path d={worried ? "M30 20 37 22" : "M30 21 37 19.5"} />
      <path d={worried ? "M43 22 50 20" : "M43 19.5 50 21"} />
    </g>
  );
}

function mouth(style: MouthStyle, expression: CharacterExpression) {
  const halfWidth = style === "wide" ? 6 : style === "small" ? 3.5 : 5;
  const left = 40 - halfWidth;
  const right = 40 + halfWidth;
  let path = `M${left} 33H${right}`;
  if (expression === "confident") {
    path = `M${left} 31q${halfWidth} 7 ${halfWidth * 2} 0`;
  } else if (expression === "worried" || expression === "pained") {
    path = `M${left} 35q${halfWidth} -6 ${halfWidth * 2} 0`;
  } else if (expression === "exhausted") {
    path = `M${left} 33q${halfWidth} 3 ${halfWidth * 2} 0`;
  } else if (style === "soft") {
    path = `M${left} 32q${halfWidth} 4 ${halfWidth * 2} 0`;
  }
  return (
    <path
      d={path}
      fill="none"
      stroke="#8C4E43"
      strokeLinecap="round"
      strokeWidth="1.4"
    />
  );
}

function accessory(
  style: AccessoryStyle,
  uniform: UniformColors,
  skinColor: string,
): ReactNode {
  switch (style) {
    case "headband":
      return (
        <path d="M26 16q14-6 28 0l-1 3q-13-5-26 0Z" fill={uniform.accent} />
      );
    case "sports-glasses":
      return (
        <g fill="none" stroke={uniform.secondary} strokeWidth="1.8">
          <rect height="7" rx="3" width="12" x="28" y="22" />
          <rect height="7" rx="3" width="12" x="40" y="22" />
          <path d="M39 25h2" />
        </g>
      );
    case "ear-tape":
      return (
        <rect
          fill={uniform.secondary}
          height="7"
          rx="2"
          stroke={skinColor}
          width="4"
          x="53"
          y="24"
        />
      );
    case "wristband":
      return (
        <g fill={uniform.accent}>
          <rect height="5" rx="2" width="7" x="13" y="67" />
          <rect height="5" rx="2" width="7" x="60" y="67" />
        </g>
      );
    case "none":
      return null;
  }
}

function uniformAccent(
  pattern: UniformPattern,
  uniform: UniformColors,
  halfWidth: number,
) {
  if (pattern === "side-stripe") {
    return (
      <path
        d={`M${40 - halfWidth} 46l3-1 3 30-4 1Z`}
        data-testid="player-character-accent"
        fill={uniform.accent}
      />
    );
  }
  if (pattern === "chevron") {
    return (
      <path
        d="m27 50 13 8 13-8-2 5-11 8-11-8Z"
        data-testid="player-character-accent"
        fill={uniform.accent}
      />
    );
  }
  if (pattern === "split") {
    return (
      <path
        d={`M40 44l${halfWidth} 4-2 28H40Z`}
        data-testid="player-character-accent"
        fill={uniform.accent}
      />
    );
  }
  return (
    <rect
      data-testid="player-character-accent"
      fill={uniform.accent}
      height="4"
      rx="2"
      width={halfWidth * 1.5}
      x={40 - halfWidth * 0.75}
      y="49"
    />
  );
}

function poseTransform(appearance: PlayerAppearance): string {
  const heightOffset = HEIGHT_OFFSET[appearance.heightBand];
  if (appearance.pose === "leaning") {
    return `translate(0 ${heightOffset + 1}) rotate(-3 40 68)`;
  }
  if (appearance.pose === "ready") {
    return `translate(0 ${heightOffset + 2}) scale(1 0.97)`;
  }
  if (appearance.pose === "celebration") {
    return `translate(0 ${heightOffset - 1})`;
  }
  return `translate(0 ${heightOffset})`;
}

export function PlayerCharacter({
  player,
  school,
  uniform: uniformOverride,
  variant = "chibi",
  className,
}: PlayerCharacterProps) {
  const visual = resolveCharacterVisual(player, school);
  const appearance = visual.appearance;
  const uniform =
    school?.uniform ?? uniformOverride ?? DEFAULT_CHARACTER_UNIFORM;
  const skinColor = SKIN_COLORS[appearance.skinTone];
  const halfWidth = BODY_HALF_WIDTH[appearance.bodyType];
  const classNames = [
    "ui-player-character",
    `ui-player-character--${appearance.tier}`,
    `ui-player-character--${variant}`,
    visual.featured ? "ui-player-character--featured" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const armLift = appearance.pose === "celebration" ? 13 : 0;

  return (
    <svg
      aria-hidden="true"
      className={classNames}
      data-body-type={appearance.bodyType}
      data-character-id={visual.characterId}
      data-expression={appearance.expression}
      data-hair-style={appearance.hairStyle}
      data-height-band={appearance.heightBand}
      data-school-motif={visual.schoolMotif}
      data-testid="player-character"
      focusable="false"
      viewBox={variant === "portrait" ? "0 0 80 90" : "0 0 80 112"}
    >
      <defs>
        <linearGradient id={`jersey-${player.id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={uniform.primary} />
          <stop offset="1" stopColor={visual.theme.ink} />
        </linearGradient>
      </defs>
      {visual.featured || appearance.tier !== "normal" ? (
        <ellipse
          cx="40"
          cy="56"
          fill={visual.theme.glow}
          opacity={visual.featured ? 0.12 : 0.06}
          rx="30"
          ry="49"
          stroke={uniform.accent}
          strokeDasharray={appearance.tier === "generational" ? "4 3" : "2 4"}
          strokeWidth="1.5"
        />
      ) : null}
      <ellipse cx="40" cy="108" fill="#152832" opacity="0.16" rx="20" ry="4" />
      <g transform={poseTransform(appearance)}>
        <path d={`M${31 - armLift * 0.3} 73 30 103h7l3-25Z`} fill={skinColor} />
        <path
          d={`M${49 + armLift * 0.3} 73 50 103h-7l-3-25Z`}
          fill={skinColor}
        />
        <path d="m28 99 10 0-1 8H25q-1-3 3-8Z" fill={uniform.secondary} />
        <path d="m42 99 10 0 3 8H43Z" fill={uniform.secondary} />
        <path
          d={`M${40 - halfWidth} 69h${halfWidth * 2}l${10 + halfWidth * 0.2} 17H41l-1-8-1 8H${30 - halfWidth * 0.2}Z`}
          fill={visual.theme.ink}
        />
        <path
          d={`M${40 - halfWidth + 1} 48q${halfWidth - 1} -6 ${halfWidth * 2 - 2} 0l1 26q-${halfWidth} 5-${halfWidth * 2} 0Z`}
          data-testid="player-character-uniform"
          fill={`url(#jersey-${player.id})`}
        />
        {uniformAccent(appearance.uniformPattern, uniform, halfWidth)}
        <path
          d={`M${40 - halfWidth + 1} 50 18 ${64 - armLift} 14 ${70 - armLift} ${39 - halfWidth} 61Z`}
          fill={skinColor}
        />
        <path
          d={`M${40 + halfWidth - 1} 50 62 ${64 - armLift} 66 ${70 - armLift} ${41 + halfWidth} 61Z`}
          fill={skinColor}
        />
        <path
          d={`M${40 - halfWidth} 48 23 ${58 - armLift} 27 ${63 - armLift} ${40 - halfWidth + 4} 57Z`}
          fill={uniform.secondary}
        />
        <path
          d={`M${40 + halfWidth} 48 57 ${58 - armLift} 53 ${63 - armLift} ${40 + halfWidth - 4} 57Z`}
          fill={uniform.secondary}
        />
        <path
          d="m35 47 5 7 5-7"
          fill="none"
          stroke={uniform.secondary}
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <SchoolEmblem
          school={school}
          compact
          height="8"
          width="8"
          x="30"
          y="53"
        />
        <text
          data-testid="player-character-number"
          fill={uniform.secondary}
          fontFamily="system-ui, sans-serif"
          fontSize="9"
          fontWeight="900"
          paintOrder="stroke"
          stroke={visual.theme.ink}
          strokeWidth="0.7"
          textAnchor="middle"
          x="43"
          y="69"
        >
          {visual.jerseyNumber}
        </text>
        <ellipse cx="25" cy="26" fill={skinColor} rx="3.2" ry="5" />
        <ellipse cx="55" cy="26" fill={skinColor} rx="3.2" ry="5" />
        {face(appearance.faceShape, skinColor, visual.skinShadow)}
        {hair(
          appearance.hairStyle,
          visual.hairColor,
          visual.hairAccent,
          visual.featured,
        )}
        {brows(appearance.browStyle, appearance.expression)}
        {eyes(appearance.eyeStyle, appearance.expression, visual.eyeColor)}
        {mouth(appearance.mouthStyle, appearance.expression)}
        {accessory(appearance.accessory, uniform, skinColor)}
      </g>
    </svg>
  );
}
