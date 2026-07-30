import type { ReactNode } from "react";
import {
  assemblePlayerAppearance,
  type AccessoryStyle,
  type BrowStyle,
  type CharacterExpression,
  type EyeStyle,
  type FaceShape,
  type HairColor,
  type HairStyle,
  type MouthStyle,
  type PlayerAppearance,
  type SkinTone,
  type UniformPattern,
} from "../domain/appearance/playerAppearance";
import type { Player } from "../domain/model/Player";
import type { UniformColors } from "../domain/model/School";

export const DEFAULT_CHARACTER_UNIFORM: UniformColors = {
  primary: "#1a5364",
  secondary: "#f4f7f8",
  accent: "#d89a2b",
};

interface PlayerCharacterProps {
  player: Player;
  uniform?: UniformColors;
  className?: string;
}

const SKIN_COLORS: Record<SkinTone, string> = {
  fair: "#f3c9aa",
  light: "#e8b68f",
  medium: "#d39a70",
  tan: "#b87951",
  deep: "#855438",
};

const HAIR_COLORS: Record<HairColor, string> = {
  black: "#171b20",
  "blue-black": "#182633",
  "dark-brown": "#35251f",
  brown: "#5a3828",
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

function faceShape(shape: FaceShape, skinColor: string): ReactNode {
  if (shape === "angular") {
    return (
      <path
        d="M26 20 Q28 9 40 8 Q52 9 54 20 L52 34 Q47 41 40 43 Q33 41 28 34 Z"
        fill={skinColor}
      />
    );
  }
  const dimensions =
    shape === "round"
      ? { rx: 15, ry: 16 }
      : shape === "wide"
        ? { rx: 16, ry: 14.5 }
        : { rx: 13.5, ry: 17 };
  return (
    <ellipse
      cx="40"
      cy="26"
      fill={skinColor}
      rx={dimensions.rx}
      ry={dimensions.ry}
    />
  );
}

function hair(style: HairStyle, color: string): ReactNode {
  switch (style) {
    case "short-spike":
      return (
        <path
          d="M25 19 28 9 32 12 36 5 40 11 45 4 47 12 54 8 55 21 Q40 13 25 21Z"
          fill={color}
        />
      );
    case "side-swept":
      return (
        <path
          d="M24 21 Q25 7 40 6 Q54 7 56 20 Q43 12 29 17 L27 27 23 25Z"
          fill={color}
        />
      );
    case "buzz":
      return (
        <path
          d="M26 18 Q28 7 40 7 Q52 7 54 18 Q40 12 26 18Z"
          fill={color}
        />
      );
    case "curly":
      return (
        <g fill={color}>
          <circle cx="28" cy="15" r="6" />
          <circle cx="35" cy="10" r="7" />
          <circle cx="43" cy="10" r="7" />
          <circle cx="51" cy="15" r="6" />
          <path d="M24 18 Q40 10 56 18 L54 24 Q40 16 26 24Z" />
        </g>
      );
    case "center-part":
      return (
        <g fill={color}>
          <path d="M24 22 Q25 7 39 6 L38 20 Q31 15 25 27Z" />
          <path d="M41 6 Q55 7 56 22 L55 27 Q49 15 42 20Z" />
        </g>
      );
    case "shaggy":
      return (
        <path
          d="M24 20 Q25 7 40 6 Q55 7 56 20 L54 30 50 25 47 31 43 23 38 29 34 22 29 29 26 24Z"
          fill={color}
        />
      );
    case "undercut":
      return (
        <g fill={color}>
          <path d="M25 19 Q27 7 42 6 Q52 8 55 15 Q41 11 28 22Z" />
          <path d="M25 19 28 30 24 27Z" opacity="0.65" />
        </g>
      );
    case "crew":
      return (
        <path
          d="M27 18 29 9 34 7 40 6 47 8 53 12 54 19 Q40 13 27 18Z"
          fill={color}
        />
      );
  }
}

function eyes(style: EyeStyle, expression: CharacterExpression): ReactNode {
  if (expression === "exhausted" || expression === "tired") {
    return (
      <g fill="none" stroke="#27313a" strokeLinecap="round" strokeWidth="1.6">
        <path d="M31 25 Q34 27 37 25" />
        <path d="M43 25 Q46 27 49 25" />
      </g>
    );
  }
  if (expression === "pained") {
    return (
      <g fill="none" stroke="#27313a" strokeLinecap="round" strokeWidth="1.7">
        <path d="M31 27 36 24" />
        <path d="M44 24 49 27" />
      </g>
    );
  }
  if (style === "round") {
    return (
      <g fill="#27313a">
        <circle cx="34" cy="25" r="1.8" />
        <circle cx="46" cy="25" r="1.8" />
      </g>
    );
  }
  if (style === "sharp") {
    return (
      <g fill="#27313a">
        <path d="M30 24 37 23 35 27Z" />
        <path d="M43 23 50 24 45 27Z" />
      </g>
    );
  }
  if (style === "narrow") {
    return (
      <g stroke="#27313a" strokeLinecap="round" strokeWidth="1.8">
        <path d="M31 25H37" />
        <path d="M43 25H49" />
      </g>
    );
  }
  return (
    <g fill="none" stroke="#27313a" strokeLinecap="round" strokeWidth="1.6">
      <path d="M31 24 Q34 27 37 25" />
      <path d="M43 25 Q46 27 49 24" />
    </g>
  );
}

function brows(style: BrowStyle, expression: CharacterExpression): ReactNode {
  const strokeWidth = style === "bold" ? 2.3 : 1.6;
  if (expression === "worried" || expression === "pained") {
    return (
      <g fill="none" stroke="#3c2d27" strokeLinecap="round" strokeWidth={strokeWidth}>
        <path d="M31 20 37 22" />
        <path d="M43 22 49 20" />
      </g>
    );
  }
  if (style === "arched") {
    return (
      <g fill="none" stroke="#3c2d27" strokeLinecap="round" strokeWidth={strokeWidth}>
        <path d="M31 21 Q34 18 37 21" />
        <path d="M43 21 Q46 18 49 21" />
      </g>
    );
  }
  if (style === "soft") {
    return (
      <g fill="none" stroke="#3c2d27" strokeLinecap="round" strokeWidth="1.2">
        <path d="M31 21 Q34 20 37 21" />
        <path d="M43 21 Q46 20 49 21" />
      </g>
    );
  }
  return (
    <g fill="none" stroke="#3c2d27" strokeLinecap="round" strokeWidth={strokeWidth}>
      <path d="M31 21 37 20" />
      <path d="M43 20 49 21" />
    </g>
  );
}

function mouth(
  style: MouthStyle,
  expression: CharacterExpression,
): ReactNode {
  const halfWidth = style === "wide" ? 6 : style === "small" ? 3.5 : 5;
  const left = 40 - halfWidth;
  const right = 40 + halfWidth;
  let path = `M${left} 33 H${right}`;
  if (expression === "confident") {
    path = `M${left} 31 Q40 37 ${right} 31`;
  } else if (expression === "worried" || expression === "pained") {
    path = `M${left} 35 Q40 29 ${right} 35`;
  } else if (expression === "exhausted") {
    path = `M${left} 33 Q40 35 ${right} 33`;
  } else if (style === "soft") {
    path = `M${left} 32 Q40 35 ${right} 32`;
  } else if (style === "firm") {
    path = `M${left} 33 L${right} 32`;
  }
  return (
    <path
      d={path}
      fill="none"
      stroke="#8c4e43"
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
        <path
          d="M26 16 Q40 10 54 16 L53 19 Q40 14 27 19Z"
          fill={uniform.accent}
        />
      );
    case "sports-glasses":
      return (
        <g fill="none" stroke={uniform.secondary} strokeWidth="1.8">
          <rect height="7" rx="3" width="12" x="28" y="22" />
          <rect height="7" rx="3" width="12" x="40" y="22" />
          <path d="M40 25H40" />
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
): ReactNode {
  if (pattern === "side-stripe") {
    return (
      <path
        d={`M${40 - halfWidth} 46 L${43 - halfWidth} 45 L${46 - halfWidth} 75 L${42 - halfWidth} 76Z`}
        data-testid="player-character-accent"
        fill={uniform.accent}
      />
    );
  }
  if (pattern === "chevron") {
    return (
      <path
        d="M27 50 40 58 53 50 51 55 40 63 29 55Z"
        data-testid="player-character-accent"
        fill={uniform.accent}
      />
    );
  }
  if (pattern === "split") {
    return (
      <path
        d={`M40 44 L${40 + halfWidth} 48 L${40 + halfWidth - 2} 76 H40Z`}
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
  uniform = DEFAULT_CHARACTER_UNIFORM,
  className,
}: PlayerCharacterProps) {
  const appearance = assemblePlayerAppearance(player);
  const skinColor = SKIN_COLORS[appearance.skinTone];
  const hairColor = HAIR_COLORS[appearance.hairColor];
  const halfWidth = BODY_HALF_WIDTH[appearance.bodyType];
  const classNames = [
    "ui-player-character",
    `ui-player-character--${appearance.tier}`,
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
      data-expression={appearance.expression}
      data-hair-style={appearance.hairStyle}
      data-height-band={appearance.heightBand}
      data-testid="player-character"
      focusable="false"
      viewBox="0 0 80 112"
    >
      {appearance.tier !== "normal" ? (
        <ellipse
          cx="40"
          cy="56"
          fill="none"
          opacity={appearance.tier === "generational" ? 0.52 : 0.28}
          rx="29"
          ry="48"
          stroke={uniform.accent}
          strokeDasharray={appearance.tier === "generational" ? "4 3" : "2 4"}
          strokeWidth="2"
        />
      ) : null}
      <ellipse cx="40" cy="108" fill="#152832" opacity="0.16" rx="20" ry="4" />
      <g transform={poseTransform(appearance)}>
        <path
          d={`M${31 - armLift * 0.3} 73 L30 103 H37 L40 78Z`}
          fill={skinColor}
        />
        <path
          d={`M${49 + armLift * 0.3} 73 L50 103 H43 L40 78Z`}
          fill={skinColor}
        />
        <path
          d="M28 99 38 99 37 107 25 107 Q24 104 28 99Z"
          fill={uniform.secondary}
        />
        <path
          d="M42 99 52 99 55 107 43 107Z"
          fill={uniform.secondary}
        />
        <path
          d={`M${40 - halfWidth} 69 H${40 + halfWidth} L${50 + halfWidth * 0.2} 86 H41 L40 78 39 86 H${30 - halfWidth * 0.2}Z`}
          fill={uniform.primary}
        />
        <path
          d={`M${40 - halfWidth + 1} 48 Q40 42 ${40 + halfWidth - 1} 48 L${40 + halfWidth} 74 Q40 79 ${40 - halfWidth} 74Z`}
          data-testid="player-character-uniform"
          fill={uniform.primary}
        />
        {uniformAccent(appearance.uniformPattern, uniform, halfWidth)}
        <path
          d={`M${40 - halfWidth + 1} 50 L${18 - armLift} ${64 - armLift} L${14 - armLift} ${70 - armLift} L${39 - halfWidth} 61Z`}
          fill={skinColor}
        />
        <path
          d={`M${40 + halfWidth - 1} 50 L${62 + armLift} ${64 - armLift} L${66 + armLift} ${70 - armLift} L${41 + halfWidth} 61Z`}
          fill={skinColor}
        />
        <path
          d={`M${40 - halfWidth} 48 L${23 - armLift * 0.4} ${58 - armLift} L${27 - armLift * 0.3} ${63 - armLift} L${40 - halfWidth + 4} 57Z`}
          fill={uniform.secondary}
        />
        <path
          d={`M${40 + halfWidth} 48 L${57 + armLift * 0.4} ${58 - armLift} L${53 + armLift * 0.3} ${63 - armLift} L${40 + halfWidth - 4} 57Z`}
          fill={uniform.secondary}
        />
        <text
          fill={uniform.secondary}
          fontFamily="system-ui, sans-serif"
          fontSize="8"
          fontWeight="900"
          textAnchor="middle"
          x="40"
          y="69"
        >
          {player.preferredPosition}
        </text>
        <ellipse cx="25" cy="26" fill={skinColor} rx="3.2" ry="5" />
        <ellipse cx="55" cy="26" fill={skinColor} rx="3.2" ry="5" />
        {faceShape(appearance.faceShape, skinColor)}
        {hair(appearance.hairStyle, hairColor)}
        {brows(appearance.browStyle, appearance.expression)}
        {eyes(appearance.eyeStyle, appearance.expression)}
        {mouth(appearance.mouthStyle, appearance.expression)}
        {accessory(appearance.accessory, uniform, skinColor)}
      </g>
    </svg>
  );
}
