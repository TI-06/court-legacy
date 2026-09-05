import { createInitialGame } from "../../../../src/app/createInitialGame";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import {
  assignGenerationalTalent,
  generateWorld,
  scheduleNextGenerationalTalentYear,
} from "../../../../src/domain/generation/generateWorld";
import { CURRENT_GAME_SCHEMA_VERSION } from "../../../../src/domain/model/GameState";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;
const userSchool = {
  name: "蒼波高校",
  shortName: "蒼波",
  regionId: "region.test",
  coachName: "高城 監督",
  uniform: {
    primary: "#173B52",
    secondary: "#F4F7F8",
    accent: "#D89A2B",
  },
};

describe("generateWorld", () => {
  it("reproduces the complete world from the same seed", () => {
    const first = generateWorld({ seed: "same-world", userSchool, data });
    const second = generateWorld({ seed: "same-world", userSchool, data });

    expect(first).toEqual(second);
  });

  it("creates one user school and fifteen rival schools", () => {
    const world = generateWorld({ seed: "school-count", userSchool, data });
    const schools = Object.values(world.schools);

    expect(schools).toHaveLength(16);
    expect(world.schools[world.userSchoolId]?.name).toBe("蒼波高校");
    expect(new Set(schools.map((school) => school.name)).size).toBe(16);
    expect(new Set(schools.map((school) => school.shortName)).size).toBe(16);
    expect(schools.every((school) => school.playerIds.length === 12)).toBe(
      true,
    );
    expect(Object.values(world.players)).toHaveLength(192);
  });

  it("creates a generic user-defined initial game without featured characters", () => {
    const input = {
      seed: "user-123:2026",
      schoolName: "青葉高校",
      schoolShortName: "青葉",
      coachName: "高橋 監督",
      regionId: "region.test",
      uniform: {
        primary: "#17365D",
        secondary: "#FFFFFF",
        accent: "#D99B2B",
      },
    };

    const first = createInitialGame(input);
    const second = createInitialGame(input);

    expect(first).toEqual(second);
    expect(first.schools[first.userSchoolId]?.name).toBe("青葉高校");
    expect(first.schools[first.userSchoolId]?.shortName).toBe("青葉");
    expect(first.schools[first.userSchoolId]?.coach.name).toBe("高橋 監督");
    expect(Object.keys(first.schools)).toHaveLength(16);

    const fullNames = Object.values(first.players).map(
      (player) => `${player.lastName} ${player.firstName}`,
    );
    for (const featuredName of [
      "瀬戸 蒼真",
      "黒羽 隼斗",
      "火神 蓮",
      "白間 湊",
    ]) {
      expect(fullNames).not.toContain(featuredName);
    }
  });

  it("normalizes every school attack distribution to one hundred percent", () => {
    const world = generateWorld({
      seed: "attack-distribution",
      userSchool,
      data,
    });

    for (const school of Object.values(world.schools)) {
      const shares = Object.values(school.tactics.attackDistribution);
      expect(
        shares.every((share) => Number.isInteger(share) && share >= 0),
      ).toBe(true);
      expect(shares.reduce((sum, share) => sum + share, 0)).toBe(100);
    }
  });

  it("assigns every player to exactly one school", () => {
    const world = generateWorld({
      seed: "school-membership",
      userSchool,
      data,
    });
    const memberships = Object.values(world.schools).flatMap(
      (school) => school.playerIds,
    );

    expect(new Set(memberships).size).toBe(memberships.length);
    expect(new Set(memberships)).toEqual(new Set(Object.keys(world.players)));
    for (const school of Object.values(world.schools)) {
      for (const id of school.playerIds) {
        expect(world.players[id]?.career.schoolId).toBe(school.id);
      }
    }
  });

  it("initializes an endless-game state with a future generational year", () => {
    const world = generateWorld({ seed: "world-state", userSchool, data });

    expect(world.schemaVersion).toBe(CURRENT_GAME_SCHEMA_VERSION);
    expect(world.yearIndex).toBe(1);
    expect(world.date).toBe("2026-04-01");
    expect(world.activeMatch).toBeNull();
    expect(world.pendingEvent).toBeNull();
    expect(world.world.nextGenerationalTalentYear).toBeGreaterThanOrEqual(5);
    expect(world.world.nextGenerationalTalentYear).toBeLessThanOrEqual(7);
    expect(world.world.generationalTalentPlayerIds).toEqual([]);
    expect(world.randomCursor).toBeGreaterThan(0);

    const school = world.schools[world.userSchoolId]!;
    expect(school.funds).toBe(700);
    expect(world.schoolManagement.lastAnnualBudgetYearIndex).toBe(1);
    expect(world.schoolManagement.fundsHistory).toEqual([
      expect.objectContaining({
        kind: "initial-funds",
        amount: 300,
        balanceAfter: 300,
      }),
      expect.objectContaining({
        kind: "annual-budget",
        amount: 400,
        balanceAfter: 700,
      }),
    ]);
  });
});

describe("generational talent scheduling", () => {
  it("schedules talents every four to six academic years", () => {
    for (let index = 0; index < 30; index += 1) {
      const nextYear = scheduleNextGenerationalTalentYear(
        10,
        new SeededRandom(`interval-${index}`),
      );

      expect(nextYear).toBeGreaterThanOrEqual(14);
      expect(nextYear).toBeLessThanOrEqual(16);
    }
  });

  it("assigns a generational player across the whole world instead of forcing the user school", () => {
    const assignedSchools = new Set<string>();
    let assignedOutsideUserSchool = false;

    for (let index = 0; index < 20; index += 1) {
      const world = generateWorld({
        seed: `assignment-world-${index}`,
        userSchool,
        data,
      });
      const result = assignGenerationalTalent({
        state: world,
        academicYear: 5,
        random: new SeededRandom(`assignment-${index}`),
        data,
      });

      assignedSchools.add(result.schoolId);
      assignedOutsideUserSchool ||= result.schoolId !== world.userSchoolId;
      expect(result.player.tier).toBe("generational");
      expect(result.player.grade).toBe(1);
      expect(result.nextGenerationalTalentYear).toBeGreaterThanOrEqual(9);
      expect(result.nextGenerationalTalentYear).toBeLessThanOrEqual(11);
    }

    expect(assignedSchools.size).toBeGreaterThan(1);
    expect(assignedOutsideUserSchool).toBe(true);
  });
});
