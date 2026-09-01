import { gameDataBootstrap } from "../../../../src/data/gameData";
import type { Player } from "../../../../src/domain/model/Player";
import type { School } from "../../../../src/domain/model/School";
import { playerId, schoolId } from "../../../../src/domain/model/identifiers";
import { calculateGrowth } from "../../../../src/domain/training/calculateGrowth";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: playerId("player-growth"),
    firstName: "蓮",
    lastName: "佐藤",
    reading: "さとう れん",
    grade: 1,
    heightCm: 180,
    bodyType: "standard",
    handedness: "right",
    preferredPosition: "OH",
    positionAptitudes: { OH: 90, MB: 40, OP: 60, S: 30, L: 25 },
    abilities: {
      spike: 50,
      jump: 50,
      receive: 50,
      serve: 50,
      set: 50,
      block: 50,
      speed: 50,
      stamina: 50,
      decision: 50,
      mental: 50,
    },
    condition: 90,
    fatigue: 10,
    morale: 70,
    trust: 50,
    academic: 60,
    personalityId: "personality.hard-worker",
    growthTypeId: "growth.standard",
    traitIds: [],
    hiddenTraitIds: [],
    tier: "normal",
    injury: null,
    career: {
      schoolId: schoolId("school-growth"),
      enrolledYear: 1,
      appearances: 0,
      setsPlayed: 0,
      points: 0,
      blocks: 0,
      serviceAces: 0,
      captainSeasons: 0,
      awardIds: [],
      bestTournamentResultId: null,
    },
    ...overrides,
  };
}

function createSchool(overrides: Partial<School> = {}): School {
  return {
    id: schoolId("school-growth"),
    name: "蒼波高校",
    shortName: "蒼波",
    regionId: "region.test",
    archetypeId: "school.balanced",
    uniform: {
      primary: "#173B52",
      secondary: "#F4F7F8",
      accent: "#D89A2B",
    },
    reputation: "unknown",
    reputationPoints: 20,
    funds: 300,
    playerIds: [playerId("player-growth")],
    alumniPlayerIds: [],
    captainPlayerId: null,
    coach: {
      name: "高城 監督",
      development: 50,
      observation: 50,
      tactics: 50,
      leadership: 50,
      charisma: 50,
      scouting: 50,
      network: 50,
      conditioning: 50,
    },
    facilities: {
      gym: 0,
      trainingRoom: 0,
      analysisRoom: 0,
      recoveryRoom: 0,
      dormitory: 0,
      scoutingNetwork: 0,
      alumniAssociation: 0,
      studyRoom: 0,
    },
    tactics: {
      serveRisk: 50,
      serveTargetPlayerId: null,
      attackTempo: "balanced",
      attackDistribution: { OH: 42, MB: 20, OP: 34, S: 4, L: 0 },
      blockSystem: "mixed",
      defenseBias: "balanced",
    },
    history: {
      seasons: 0,
      officialWins: 0,
      officialLosses: 0,
      prefecturalTitles: 0,
      nationalAppearances: 0,
      nationalTitles: 0,
    },
    ...overrides,
  };
}

describe("calculateGrowth", () => {
  it("returns integer growth with an explainable modifier breakdown", () => {
    const result = calculateGrowth({
      baseGrowth: 8,
      player: createPlayer(),
      school: createSchool(),
      growthType: data.growthTypes.get("growth.standard")!,
      personality: data.personalities.get("personality.hard-worker")!,
    });

    expect(Number.isInteger(result.amount)).toBe(true);
    expect(result.amount).toBeGreaterThan(0);
    expect(result.modifiers.map((modifier) => modifier.code)).toEqual([
      "grade",
      "growth-type",
      "personality",
      "facility",
      "coach",
      "condition",
      "academic",
    ]);
    expect(
      result.modifiers.every((modifier) => Number.isInteger(modifier.percent)),
    ).toBe(true);
  });

  it("applies an explicit shop training boost to growth and reports it", () => {
    const input = {
      baseGrowth: 20,
      player: createPlayer({ fatigue: 0, condition: 100, academic: 80 }),
      school: createSchool(),
      growthType: data.growthTypes.get("growth.standard")!,
      personality: data.personalities.get("personality.calm")!,
    };
    const ordinary = calculateGrowth(input);
    const boosted = calculateGrowth({
      ...input,
      additionalModifiers: [
        {
          code: "shop-training-boost" as const,
          label: "練習効率アップ",
          percent: 120,
        },
      ],
    });

    expect(boosted.amount).toBeGreaterThan(ordinary.amount);
    expect(boosted.modifiers).toContainEqual({
      code: "shop-training-boost",
      label: "練習効率アップ",
      percent: 120,
    });
  });

  it("applies grade and growth-type differences", () => {
    const early = data.growthTypes.get("growth.early")!;
    const gradeOne = calculateGrowth({
      baseGrowth: 8,
      player: createPlayer({ grade: 1 }),
      school: createSchool(),
      growthType: early,
      personality: data.personalities.get("personality.calm")!,
    });
    const gradeThree = calculateGrowth({
      baseGrowth: 8,
      player: createPlayer({ grade: 3 }),
      school: createSchool(),
      growthType: early,
      personality: data.personalities.get("personality.calm")!,
    });

    expect(gradeOne.amount).toBeGreaterThan(gradeThree.amount);
  });

  it("rewards stronger coaching and training facilities", () => {
    const weakEnvironment = calculateGrowth({
      baseGrowth: 10,
      player: createPlayer(),
      school: createSchool({
        coach: { ...createSchool().coach, development: 20 },
        facilities: { ...createSchool().facilities, trainingRoom: 0 },
      }),
      growthType: data.growthTypes.get("growth.standard")!,
      personality: data.personalities.get("personality.calm")!,
    });
    const strongEnvironment = calculateGrowth({
      baseGrowth: 10,
      player: createPlayer(),
      school: createSchool({
        coach: { ...createSchool().coach, development: 90 },
        facilities: { ...createSchool().facilities, trainingRoom: 4 },
      }),
      growthType: data.growthTypes.get("growth.standard")!,
      personality: data.personalities.get("personality.calm")!,
    });

    expect(strongEnvironment.amount).toBeGreaterThan(weakEnvironment.amount);
  });

  it("ignores legacy fatigue while keeping academic restriction active", () => {
    const input = {
      baseGrowth: 40,
      school: createSchool(),
      growthType: data.growthTypes.get("growth.standard")!,
      personality: data.personalities.get("personality.calm")!,
    };
    const baseline = calculateGrowth({
      ...input,
      player: createPlayer({ fatigue: 0, academic: 70, condition: 100 }),
    });
    const fatigued = calculateGrowth({
      ...input,
      player: createPlayer({ fatigue: 100, academic: 70, condition: 100 }),
    });
    const restricted = calculateGrowth({
      ...input,
      player: createPlayer({ fatigue: 100, academic: 20, condition: 100 }),
    });

    expect(fatigued.amount).toBe(baseline.amount);
    expect(fatigued.modifiers.some((modifier) => modifier.code === "fatigue")).toBe(
      false,
    );
    expect(restricted.amount).toBeLessThan(baseline.amount);
    expect(restricted.academicRestricted).toBe(true);
  });
});