import { gameDataBootstrap } from "../../../../src/data/gameData";
import {
  generateInitialSquad,
  generatePlayer,
} from "../../../../src/domain/generation/generatePlayer";
import type { PlayerAbilities } from "../../../../src/domain/model/Player";
import { playerId, schoolId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;

describe("generatePlayer", () => {
  it("reproduces the same player from the same seed and input", () => {
    const createInput = () => ({
      id: playerId("player-test-1"),
      schoolId: schoolId("school-test"),
      grade: 1 as const,
      enrolledYear: 1,
      tier: "normal" as const,
      data,
      excludedFullNames: new Set<string>(),
      excludedAppearanceSeeds: new Set<number>(),
    });

    const first = generatePlayer({
      ...createInput(),
      random: new SeededRandom("same-player"),
    });
    const second = generatePlayer({
      ...createInput(),
      random: new SeededRandom("same-player"),
    });

    expect(first).toEqual(second);
  });

  it("creates integer abilities and player state inside supported ranges", () => {
    const player = generatePlayer({
      id: playerId("player-range"),
      schoolId: schoolId("school-test"),
      grade: 2,
      enrolledYear: 1,
      tier: "normal",
      data,
      random: new SeededRandom("range-player"),
      excludedFullNames: new Set(),
      excludedAppearanceSeeds: new Set(),
    });

    expect(player.grade).toBe(2);
    expect(player.heightCm).toBeGreaterThanOrEqual(160);
    expect(player.heightCm).toBeLessThanOrEqual(205);
    expect(player.condition).toBeGreaterThanOrEqual(75);
    expect(player.condition).toBeLessThanOrEqual(100);
    expect(player.fatigue).toBe(0);
    expect(player.career.schoolId).toBe(schoolId("school-test"));
    expect(player.career.enrolledYear).toBe(1);

    for (const value of Object.values(player.abilities)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    for (const value of Object.values(player.positionAptitudes)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it("uses volleyball-specific height bands for each preferred position", () => {
    const ranges = {
      L: [160, 180],
      S: [166, 190],
      OH: [168, 195],
      OP: [172, 200],
      MB: [178, 205],
    } as const;

    for (const [position, [minimum, maximum]] of Object.entries(ranges)) {
      for (let index = 0; index < 30; index += 1) {
        const player = generatePlayer({
          id: playerId(`player-${position}-${index}`),
          schoolId: schoolId("school-test"),
          grade: 1,
          enrolledYear: 1,
          tier: "normal",
          preferredPosition: position as keyof typeof ranges,
          data,
          random: new SeededRandom(`height-${position}-${index}`),
          excludedFullNames: new Set(),
          excludedAppearanceSeeds: new Set(),
        });

        expect(player.heightCm).toBeGreaterThanOrEqual(minimum);
        expect(player.heightCm).toBeLessThanOrEqual(maximum);
      }
    }
  });

  it("keeps left-handed players uncommon but possible", () => {
    const players = Array.from({ length: 200 }, (_, index) =>
      generatePlayer({
        id: playerId(`player-hand-${index}`),
        schoolId: schoolId("school-test"),
        grade: 1,
        enrolledYear: 1,
        tier: "normal",
        data,
        random: new SeededRandom(`hand-${index}`),
        excludedFullNames: new Set(),
        excludedAppearanceSeeds: new Set(),
      }),
    );
    const leftHandedCount = players.filter(
      (player) => player.handedness === "left",
    ).length;

    expect(leftHandedCount).toBeGreaterThanOrEqual(8);
    expect(leftHandedCount).toBeLessThanOrEqual(30);
  });

  it("makes generational players distinctly stronger without exceeding limits", () => {
    const normal = generatePlayer({
      id: playerId("player-normal"),
      schoolId: schoolId("school-test"),
      grade: 1,
      enrolledYear: 1,
      tier: "normal",
      preferredPosition: "OH",
      data,
      random: new SeededRandom("tier-comparison"),
      excludedFullNames: new Set(),
      excludedAppearanceSeeds: new Set(),
    });
    const generational = generatePlayer({
      id: playerId("player-generational"),
      schoolId: schoolId("school-test"),
      grade: 1,
      enrolledYear: 1,
      tier: "generational",
      preferredPosition: "OH",
      data,
      random: new SeededRandom("tier-comparison"),
      excludedFullNames: new Set(),
      excludedAppearanceSeeds: new Set(),
    });
    const average = (values: PlayerAbilities) =>
      Object.values(values).reduce((sum, value) => sum + value, 0) /
      Object.values(values).length;

    expect(
      average(generational.abilities) - average(normal.abilities),
    ).toBeGreaterThanOrEqual(15);
    expect(generational.traitIds.length).toBeGreaterThanOrEqual(2);
    expect(
      Math.max(...Object.values(generational.abilities)),
    ).toBeLessThanOrEqual(100);
  });
});

describe("generateInitialSquad", () => {
  it("creates twelve visually distinct players with four players per grade", () => {
    const squad = generateInitialSquad({
      schoolId: schoolId("school-squad"),
      academicYear: 1,
      firstPlayerNumber: 1,
      data,
      random: new SeededRandom("initial-squad"),
    });

    expect(squad).toHaveLength(12);
    expect(squad.filter((player) => player.grade === 1)).toHaveLength(4);
    expect(squad.filter((player) => player.grade === 2)).toHaveLength(4);
    expect(squad.filter((player) => player.grade === 3)).toHaveLength(4);
    expect(new Set(squad.map((player) => player.appearanceSeed)).size).toBe(12);
    expect(
      new Set(squad.map((player) => `${player.lastName} ${player.firstName}`))
        .size,
    ).toBe(12);
    expect(new Set(squad.map((player) => player.id)).size).toBe(12);
  });

  it("includes all essential court roles in the initial squad", () => {
    const squad = generateInitialSquad({
      schoolId: schoolId("school-roles"),
      academicYear: 1,
      firstPlayerNumber: 1,
      data,
      random: new SeededRandom("role-squad"),
    });
    const positions = new Set(squad.map((player) => player.preferredPosition));

    for (const position of ["OH", "MB", "OP", "S", "L"] as const) {
      expect(positions.has(position)).toBe(true);
    }
  });
});
