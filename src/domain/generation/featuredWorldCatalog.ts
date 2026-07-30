import {
  clampAbility,
  type BodyType,
  type Player,
  type PlayerAbilities,
  type Position,
} from "../model/Player";
import type { UniformColors } from "../model/School";

export interface FeaturedPlayerProfile {
  firstName: string;
  lastName: string;
  reading: string;
  position: Position;
  preferredGrade: 1 | 2 | 3;
  heightCm: number;
  bodyType: BodyType;
  appearanceSeed: number;
  abilityMinimums: Partial<PlayerAbilities>;
}

export interface FeaturedSchoolSetup {
  name: string;
  shortName: string;
  coachName: string;
  uniform: UniformColors;
  featuredPlayer: FeaturedPlayerProfile;
}

export const FEATURED_SCHOOL_SETUPS: readonly FeaturedSchoolSetup[] = [
  {
    name: "青嵐高校",
    shortName: "青嵐",
    coachName: "水城 監督",
    uniform: {
      primary: "#122E50",
      secondary: "#F4F8FA",
      accent: "#20A8B5",
    },
    featuredPlayer: {
      firstName: "蒼真",
      lastName: "瀬戸",
      reading: "せと そうま",
      position: "S",
      preferredGrade: 2,
      heightCm: 186,
      bodyType: "slim",
      appearanceSeed: 701_007,
      abilityMinimums: {
        set: 86,
        decision: 83,
        mental: 80,
        speed: 72,
      },
    },
  },
  {
    name: "烏峰高校",
    shortName: "烏峰",
    coachName: "黒木 監督",
    uniform: {
      primary: "#171B22",
      secondary: "#F7F7F4",
      accent: "#F17819",
    },
    featuredPlayer: {
      firstName: "隼斗",
      lastName: "黒羽",
      reading: "くろば はやと",
      position: "OH",
      preferredGrade: 2,
      heightCm: 174,
      bodyType: "muscular",
      appearanceSeed: 1_010_010,
      abilityMinimums: {
        spike: 88,
        jump: 86,
        speed: 79,
        receive: 70,
      },
    },
  },
  {
    name: "紅耀高校",
    shortName: "紅耀",
    coachName: "獅子堂 監督",
    uniform: {
      primary: "#2A2529",
      secondary: "#F8F4F2",
      accent: "#A82334",
    },
    featuredPlayer: {
      firstName: "蓮",
      lastName: "火神",
      reading: "ひがみ れん",
      position: "OP",
      preferredGrade: 2,
      heightCm: 188,
      bodyType: "muscular",
      appearanceSeed: 1_001_001,
      abilityMinimums: {
        spike: 90,
        block: 82,
        serve: 82,
        mental: 82,
      },
    },
  },
  {
    name: "白凪高校",
    shortName: "白凪",
    coachName: "霧島 監督",
    uniform: {
      primary: "#EDF5FA",
      secondary: "#173957",
      accent: "#65B5DB",
    },
    featuredPlayer: {
      firstName: "湊",
      lastName: "白間",
      reading: "しろま みなと",
      position: "L",
      preferredGrade: 3,
      heightCm: 168,
      bodyType: "slim",
      appearanceSeed: 4_013_013,
      abilityMinimums: {
        receive: 88,
        speed: 84,
        decision: 80,
        mental: 78,
      },
    },
  },
] as const;

export function findFeaturedSchoolSetup(
  name: string,
  shortName?: string,
): FeaturedSchoolSetup | null {
  return (
    FEATURED_SCHOOL_SETUPS.find(
      (candidate) =>
        candidate.name === name ||
        (shortName !== undefined && candidate.shortName === shortName),
    ) ?? null
  );
}

function selectFeaturedPlayer(
  squad: readonly Player[],
  profile: FeaturedPlayerProfile,
): Player | null {
  return (
    squad.find(
      (player) =>
        player.preferredPosition === profile.position &&
        player.grade === profile.preferredGrade,
    ) ??
    squad.find((player) => player.preferredPosition === profile.position) ??
    squad[0] ??
    null
  );
}

export function applyFeaturedPlayerProfile(
  squad: readonly Player[],
  profile: FeaturedPlayerProfile | null,
): Player[] {
  if (!profile) {
    return [...squad];
  }

  const selected = selectFeaturedPlayer(squad, profile);
  if (!selected) {
    return [];
  }

  return squad.map((player) => {
    if (player.id !== selected.id) {
      return player;
    }

    const abilities = { ...player.abilities };
    for (const [ability, minimum] of Object.entries(
      profile.abilityMinimums,
    ) as [keyof PlayerAbilities, number][]) {
      abilities[ability] = clampAbility(Math.max(abilities[ability], minimum));
    }

    return {
      ...player,
      firstName: profile.firstName,
      lastName: profile.lastName,
      reading: profile.reading,
      heightCm: profile.heightCm,
      bodyType: profile.bodyType,
      preferredPosition: profile.position,
      positionAptitudes: {
        ...player.positionAptitudes,
        [profile.position]: Math.max(
          player.positionAptitudes[profile.position],
          92,
        ),
      },
      abilities,
      appearanceSeed: profile.appearanceSeed,
    };
  });
}
