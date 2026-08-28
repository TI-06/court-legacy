import { createDemoGame } from "../../../../src/app/createDemoGame";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generatePlayer } from "../../../../src/domain/generation/generatePlayer";
import type { GameState } from "../../../../src/domain/model/GameState";
import { playerId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import {
  calculateRecruitTierProbabilities,
  selectRecruitTier,
  type RecruitTier,
} from "../../../../src/domain/scouting/recruitmentTierProbability";
import type { MiddleSchoolAchievement } from "../../../../src/domain/scouting/scoutReport";
import type {
  ScoutingCandidateInsight,
  ScoutingCandidatePool,
  ScoutingCandidateTruth,
} from "../../../../worker/data/ScoutingStore";
import {
  buildServerScoutReports,
  generateServerScoutingCandidateAtIndex,
  generateServerScoutingCandidates,
  scoutingCycleKey,
} from "../../../../worker/scouting/serverScoutingBoard";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const gameData = gameDataBootstrap.data;

function legacyAchievementForTier(
  tier: RecruitTier,
  random: SeededRandom,
): MiddleSchoolAchievement {
  const roll = random.int(1, 100);

  switch (tier) {
    case "monster":
      return roll <= 75 ? "national-event" : "prefectural-selection";
    case "generational":
      return roll <= 55 ? "national-event" : "prefectural-selection";
    case "elite":
      if (roll <= 20) return "national-event";
      if (roll <= 70) return "prefectural-selection";
      return "prefectural-best-eight";
    case "promising":
      if (roll <= 20) return "prefectural-selection";
      if (roll <= 70) return "prefectural-best-eight";
      return "regional-starter";
    case "normal":
      if (roll <= 15) return "prefectural-best-eight";
      if (roll <= 70) return "regional-starter";
      return "unknown";
  }
}

function legacyRecentSeasonRating(state: GameState): number {
  const school = state.schools[state.userSchoolId];
  const ratings = school?.history.recentSeasonRatings ?? [];
  return ratings.at(-1) ?? 50;
}

function legacyGenerateSix(state: GameState): ScoutingCandidateTruth[] {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error("user school is missing");
  }

  const cycleKey = scoutingCycleKey(state);
  const random = new SeededRandom(`${state.seed}:scouting:${cycleKey}`);
  const probabilities = calculateRecruitTierProbabilities({
    reputationPoints: school.reputationPoints,
    coachScouting: school.coach.scouting,
    scoutingNetworkLevel: school.facilities.scoutingNetwork,
    dormitoryLevel: school.facilities.dormitory,
    recentSeasonRating: legacyRecentSeasonRating(state),
  });
  const excludedFullNames = new Set(
    Object.values(state.players).map(
      (player) => `${player.lastName} ${player.firstName}`,
    ),
  );

  return Array.from({ length: 6 }, (_, index) => {
    const tier = selectRecruitTier(probabilities, random);
    const player = generatePlayer({
      id: playerId(
        `scout-${state.userSchoolId}-${state.yearIndex}-${index + 1}`,
      ),
      schoolId: state.userSchoolId,
      grade: 1,
      enrolledYear: state.yearIndex + 1,
      tier,
      data: gameData,
      random,
      excludedFullNames,
    });

    return {
      player,
      middleSchoolAchievement: legacyAchievementForTier(tier, random),
    };
  });
}

function stateExcludedNames(state: GameState): Set<string> {
  return new Set(
    Object.values(state.players).map(
      (player) => `${player.lastName} ${player.firstName}`,
    ),
  );
}

function poolFor(
  state: GameState,
  candidates: ScoutingCandidateTruth[],
): ScoutingCandidatePool {
  return {
    userId: "user-shop-scout",
    cycleKey: scoutingCycleKey(state),
    creationOperationId: "operation-shop-scout",
    candidates,
  };
}

describe("server scouting board Phase 5 integration", () => {
  it("keeps the original six candidate truth objects byte-equivalent", () => {
    const state = createDemoGame();

    expect(generateServerScoutingCandidates(state)).toEqual(
      legacyGenerateSix(state),
    );
  });

  it(
    "generates index seven deterministically without rerolling the original six",
    () => {
      const state = createDemoGame();
      const originalSix = generateServerScoutingCandidates(state);
      const excluded = stateExcludedNames(state);

      const first = generateServerScoutingCandidateAtIndex(state, 7, excluded);
      const second = generateServerScoutingCandidateAtIndex(state, 7, excluded);
      const originalNames = new Set(
        originalSix.map(
          ({ player }) => `${player.lastName} ${player.firstName}`,
        ),
      );

      expect(second).toEqual(first);
      expect(first.player.id).toBe(
        playerId(`scout-${state.userSchoolId}-${state.yearIndex}-7`),
      );
      expect(originalNames).not.toContain(
        `${first.player.lastName} ${first.player.firstName}`,
      );
      expect(generateServerScoutingCandidates(state)).toEqual(originalSix);
    },
  );

  it(
    "applies candidate insights without rerolling unaffected public reports",
    () => {
      const state = createDemoGame();
      const candidates = generateServerScoutingCandidates(state);
      const pool = poolFor(state, candidates);
      const baseline = buildServerScoutReports(state, pool, []);
      const target = candidates[0]!.player.id;
      const insights: ScoutingCandidateInsight[] = [
        {
          candidateId: target,
          overallPrecision: "researched",
          potentialPrecision: "appraised",
        },
      ];

      const improved = buildServerScoutReports(state, pool, insights);
      const repeated = buildServerScoutReports(state, pool, insights);

      expect(improved).toEqual(repeated);
      expect(improved[0]!.confidence).toBe("high");
      expect(
        improved[0]!.estimatedPotential.max -
          improved[0]!.estimatedPotential.min,
      ).toBeLessThanOrEqual(4);
      expect(improved.slice(1)).toEqual(baseline.slice(1));
      expect(JSON.stringify(improved)).not.toContain('"tier"');
      expect(JSON.stringify(improved)).not.toContain('"hiddenTraitIds"');
    },
  );
});
