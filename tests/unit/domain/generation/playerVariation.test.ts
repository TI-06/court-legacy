import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generatePlayer } from "../../../../src/domain/generation/generatePlayer";
import type { Player, PlayerTier } from "../../../../src/domain/model/Player";
import { playerId, schoolId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;
const TIERS: readonly PlayerTier[] = [
  "normal",
  "promising",
  "elite",
  "generational",
  "monster",
];

function generateTierPlayer(tier: PlayerTier, index: number): Player {
  return generatePlayer({
    id: playerId(`variation-${tier}-${index}`),
    schoolId: schoolId("school-variation"),
    grade: 1,
    enrolledYear: 1,
    tier,
    preferredPosition: "OH",
    data,
    random: new SeededRandom(`variation-${index}`),
    excludedFullNames: new Set(),
  });
}

function overall(player: Player): number {
  const values = Object.values(player.abilities);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("V2 player variation", () => {
  it("supports five internal player classes with increasing expected ability", () => {
    const averages = TIERS.map((tier) => {
      const players = Array.from({ length: 160 }, (_, index) =>
        generateTierPlayer(tier, index),
      );
      return (
        players.reduce((sum, player) => sum + overall(player), 0) /
        players.length
      );
    });

    for (let index = 1; index < averages.length; index += 1) {
      expect(averages[index]).toBeGreaterThan(averages[index - 1]!);
    }

    const monsters = Array.from({ length: 160 }, (_, index) =>
      generateTierPlayer("monster", index),
    );
    expect(
      Math.max(
        ...monsters.flatMap((player) => Object.values(player.abilities)),
      ),
    ).toBeLessThanOrEqual(100);
    expect(
      monsters.some((player) =>
        Object.values(player.abilities).some((value) => value < 90),
      ),
    ).toBe(true);
  });

  it("stores bounded hidden development characteristics on every generated player", () => {
    for (const tier of TIERS) {
      const player = generateTierPlayer(tier, 1);
      const characteristics = [
        player.potential,
        player.trainingEfficiency,
        player.matchConsistency,
        player.bigMatch,
        player.injuryResistance,
        player.leadership,
        player.teamAdaptation,
      ];

      for (const value of characteristics) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      expect([1, 2, 3]).toContain(player.growthPeakGrade);
    }
  });

  it("keeps adjacent tiers overlapping instead of making class alone determine strength", () => {
    const samples = TIERS.map((tier) =>
      Array.from({ length: 160 }, (_, index) =>
        overall(generateTierPlayer(tier, index)),
      ),
    );

    for (let index = 1; index < samples.length; index += 1) {
      const lower = samples[index - 1]!;
      const higher = samples[index]!;
      expect(Math.max(...lower)).toBeGreaterThan(Math.min(...higher));
    }
  });
});
