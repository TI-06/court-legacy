import {
  calculateRecruitTierProbabilities,
  selectRecruitTier,
} from "../../../../src/domain/scouting/recruitmentTierProbability";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";

const weakSchool = {
  reputationPoints: 40,
  coachScouting: 35,
  scoutingNetworkLevel: 0,
  dormitoryLevel: 0,
  recentSeasonRating: 25,
};

const strongSchool = {
  reputationPoints: 1320,
  coachScouting: 92,
  scoutingNetworkLevel: 5,
  dormitoryLevel: 5,
  recentSeasonRating: 92,
};

describe("recruitment tier probability", () => {
  it("always returns an integer 10000-basis-point distribution", () => {
    for (const input of [weakSchool, strongSchool]) {
      const probabilities = calculateRecruitTierProbabilities(input);
      const values = Object.values(probabilities);

      expect(values.every(Number.isInteger)).toBe(true);
      expect(values.every((value) => value > 0)).toBe(true);
      expect(values.reduce((sum, value) => sum + value, 0)).toBe(10_000);
    }
  });

  it("raises stronger-player chances as school appeal improves", () => {
    const weak = calculateRecruitTierProbabilities(weakSchool);
    const strong = calculateRecruitTierProbabilities(strongSchool);

    expect(strong.normal).toBeLessThan(weak.normal);
    expect(strong.promising).toBeGreaterThan(weak.promising);
    expect(strong.elite).toBeGreaterThan(weak.elite);
    expect(strong.generational).toBeGreaterThan(weak.generational);
    expect(strong.monster).toBeGreaterThan(weak.monster);
  });

  it("keeps generational and monster recruits rare even at a maximum-strength school", () => {
    const probabilities = calculateRecruitTierProbabilities({
      reputationPoints: 1400,
      coachScouting: 100,
      scoutingNetworkLevel: 5,
      dormitoryLevel: 5,
      recentSeasonRating: 100,
    });

    expect(probabilities.generational).toBeGreaterThan(0);
    expect(probabilities.generational).toBeLessThanOrEqual(35);
    expect(probabilities.monster).toBeGreaterThan(0);
    expect(probabilities.monster).toBeLessThanOrEqual(10);
    expect(probabilities.normal).toBeGreaterThan(0);
  });

  it("does not make rare classes impossible at a low-reputation school", () => {
    const probabilities = calculateRecruitTierProbabilities({
      reputationPoints: 0,
      coachScouting: 0,
      scoutingNetworkLevel: 0,
      dormitoryLevel: 0,
      recentSeasonRating: 0,
    });

    expect(probabilities.generational).toBeGreaterThan(0);
    expect(probabilities.monster).toBeGreaterThan(0);
  });

  it("reproduces tier rolls from the same seed", () => {
    const probabilities = calculateRecruitTierProbabilities(strongSchool);
    const firstRandom = new SeededRandom("recruit-tier-seed");
    const secondRandom = new SeededRandom("recruit-tier-seed");

    const first = Array.from({ length: 200 }, () =>
      selectRecruitTier(probabilities, firstRandom),
    );
    const second = Array.from({ length: 200 }, () =>
      selectRecruitTier(probabilities, secondRandom),
    );

    expect(first).toEqual(second);
  });
});
