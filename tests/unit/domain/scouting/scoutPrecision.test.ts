import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generatePlayer } from "../../../../src/domain/generation/generatePlayer";
import { playerId, schoolId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { createScoutReport } from "../../../../src/domain/scouting/scoutReport";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;

function createCandidate() {
  return generatePlayer({
    id: playerId("shop-scout-precision"),
    schoolId: schoolId("school-shop-scout"),
    grade: 1,
    enrolledYear: 2,
    tier: "elite",
    data,
    random: new SeededRandom("shop-scout-precision-player"),
    excludedFullNames: new Set(),
  });
}

describe("shop scouting precision", () => {
  it("forces researched reports to high confidence without exposing hidden truth", () => {
    const player = createCandidate();
    const report = createScoutReport({
      player,
      middleSchoolAchievement: "prefectural-selection",
      observation: 10,
      scoutingNetworkLevel: 0,
      overallPrecision: "researched",
      potentialPrecision: "researched",
      random: new SeededRandom("researched-report"),
    });
    const serialized = JSON.stringify(report);

    expect(report.confidence).toBe("high");
    expect(report.estimatedOverall.max - report.estimatedOverall.min).toBeLessThan(
      18,
    );
    expect(
      report.estimatedPotential.max - report.estimatedPotential.min,
    ).toBeLessThan(24);
    expect(serialized).not.toContain('"tier"');
    expect(serialized).not.toContain('"hiddenTraitIds"');
    expect(serialized).not.toContain(`"potential":${player.potential}`);
  });

  it("keeps appraised potential within a maximum half-width of two", () => {
    const player = createCandidate();
    const report = createScoutReport({
      player,
      middleSchoolAchievement: "prefectural-best-eight",
      observation: 15,
      scoutingNetworkLevel: 0,
      overallPrecision: "normal",
      potentialPrecision: "appraised",
      random: new SeededRandom("appraised-report"),
    });

    expect(report.estimatedPotential.max - report.estimatedPotential.min).toBeLessThanOrEqual(
      4,
    );
    expect(report.estimatedPotential.min).toBeGreaterThanOrEqual(0);
    expect(report.estimatedPotential.max).toBeLessThanOrEqual(100);
  });

  it("is stable for the same candidate, precision state, and seed", () => {
    const player = createCandidate();
    const input = {
      player,
      middleSchoolAchievement: "regional-starter" as const,
      observation: 35,
      scoutingNetworkLevel: 1,
      overallPrecision: "researched" as const,
      potentialPrecision: "appraised" as const,
    };

    const first = createScoutReport({
      ...input,
      random: new SeededRandom("stable-shop-report"),
    });
    const second = createScoutReport({
      ...input,
      random: new SeededRandom("stable-shop-report"),
    });

    expect(second).toEqual(first);
  });
});
