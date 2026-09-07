import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { advanceRivalWorld } from "../../../../src/domain/world/rivalWorldProgression";

const managedFacilities = [
  "gym",
  "trainingRoom",
  "analysisRoom",
  "recoveryRoom",
  "scoutingNetwork",
] as const;

describe("rival facility progression under the Lv.50 economy", () => {
  it("can progress strong CPU schools beyond the legacy Lv.5 cap without jumping wildly", () => {
    const baseline = createDemoGame();
    const rival = Object.values(baseline.schools).find(
      (school) => school.id !== baseline.userSchoolId,
    )!;
    rival.funds = 2_000;
    rival.reputationPoints = 900;
    rival.history.recentSeasonRatings = [100, 100, 100];
    for (const key of managedFacilities) rival.facilities[key] = 5;

    let highestObserved = 5;
    for (let index = 0; index < 100; index += 1) {
      const result = advanceRivalWorld(
        baseline,
        gameData,
        new SeededRandom(`cpu-facility-${index}`),
      );
      const progressed = result.schools[rival.id]!;
      highestObserved = Math.max(
        highestObserved,
        ...managedFacilities.map((key) => progressed.facilities[key]),
      );
      expect(
        Math.max(...managedFacilities.map((key) => progressed.facilities[key])),
      ).toBeLessThanOrEqual(8);
    }

    expect(highestObserved).toBeGreaterThan(5);
  });
});
