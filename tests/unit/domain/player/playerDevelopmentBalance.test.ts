import { describe, expect, it } from "vitest";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import type { Player } from "../../../../src/domain/model/Player";
import {
  applyLongTermAbilityGrowth,
  calculateLongTermAbilityCeiling,
  calculateMatchExperienceAmount,
  growthGradeMultiplier,
} from "../../../../src/domain/player/playerDevelopment";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}
const data = gameDataBootstrap.data;

function growth(id: string) {
  const value = data.growthTypes.get(id);
  if (!value) throw new Error(`growth type missing: ${id}`);
  return value;
}

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-growth-test" as Player["id"],
    firstName: "蓮",
    lastName: "青木",
    reading: "あおき れん",
    grade: 1,
    heightCm: 185,
    bodyType: "standard",
    handedness: "right",
    preferredPosition: "OH",
    positionAptitudes: { OH: 90, MB: 40, OP: 70, S: 40, L: 35 },
    abilities: {
      spike: 60,
      jump: 60,
      receive: 60,
      serve: 60,
      set: 60,
      block: 60,
      speed: 60,
      stamina: 60,
      decision: 60,
      mental: 60,
    },
    condition: 70,
    fatigue: 0,
    morale: 70,
    trust: 50,
    academic: 70,
    personalityId: "personality.hard-worker",
    growthTypeId: "growth.standard",
    traitIds: [],
    hiddenTraitIds: [],
    tier: "normal",
    potential: 75,
    injury: null,
    career: {
      schoolId: "school-growth-test" as Player["career"]["schoolId"],
      enrolledYear: 2026,
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

describe("Phase19 player development policy", () => {
  it("keeps the long-term ceiling monotonic by potential and talent tier", () => {
    const normal = calculateLongTermAbilityCeiling(70, "normal");
    const highPotential = calculateLongTermAbilityCeiling(90, "normal");
    const elite = calculateLongTermAbilityCeiling(90, "elite");
    const generational = calculateLongTermAbilityCeiling(90, "generational");

    expect(highPotential).toBeGreaterThanOrEqual(normal);
    expect(elite).toBeGreaterThanOrEqual(highPotential);
    expect(generational).toBeGreaterThanOrEqual(elite);
  });

  it("makes early bloomers stronger in grade 1 and late bloomers stronger in grade 3", () => {
    expect(growthGradeMultiplier(1, growth("growth.early"))).toBeGreaterThan(
      growthGradeMultiplier(1, growth("growth.late")),
    );
    expect(growthGradeMultiplier(3, growth("growth.late"))).toBeGreaterThan(
      growthGradeMultiplier(3, growth("growth.early")),
    );
  });

  it("makes match-type players gain more from matches than practice-type players", () => {
    const matchType = player({ growthTypeId: "growth.match" });
    const practiceType = player({ growthTypeId: "growth.practice" });

    const matchAmount = calculateMatchExperienceAmount({
      player: matchType,
      growthType: growth("growth.match"),
      lost: false,
      strongerOpponent: false,
    });
    const practiceAmount = calculateMatchExperienceAmount({
      player: practiceType,
      growthType: growth("growth.practice"),
      lost: false,
      strongerOpponent: false,
    });

    expect(matchAmount).toBeGreaterThan(practiceAmount);
    expect(matchAmount).toBeLessThanOrEqual(2);
  });

  it("gives adversity types a bounded bonus after difficult losses", () => {
    const adversity = player({
      grade: 3,
      growthTypeId: "growth.adversity",
    });
    const normal = calculateMatchExperienceAmount({
      player: adversity,
      growthType: growth("growth.adversity"),
      lost: false,
      strongerOpponent: false,
    });
    const difficultLoss = calculateMatchExperienceAmount({
      player: adversity,
      growthType: growth("growth.adversity"),
      lost: true,
      strongerOpponent: true,
    });

    expect(difficultLoss).toBeGreaterThan(normal);
    expect(difficultLoss).toBeLessThanOrEqual(2);
  });

  it("dampens growth near the canonical ceiling and never exceeds it", () => {
    const ceiling = calculateLongTermAbilityCeiling(80, "normal");
    const nearCeiling = applyLongTermAbilityGrowth(
      ceiling - 1,
      5,
      80,
      "normal",
    );
    const capped = applyLongTermAbilityGrowth(ceiling, 5, 80, "normal");

    expect(nearCeiling).toBe(ceiling);
    expect(capped).toBe(ceiling);
  });
});
