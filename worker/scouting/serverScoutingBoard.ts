import { gameDataBootstrap } from "../../src/data/gameData";
import { generatePlayer } from "../../src/domain/generation/generatePlayer";
import type { GameState } from "../../src/domain/model/GameState";
import { playerId } from "../../src/domain/model/identifiers";
import { SeededRandom } from "../../src/domain/random/SeededRandom";
import {
  calculateRecruitTierProbabilities,
  selectRecruitTier,
  type RecruitTier,
} from "../../src/domain/scouting/recruitmentTierProbability";
import {
  createScoutReport,
  type MiddleSchoolAchievement,
  type ScoutReport,
} from "../../src/domain/scouting/scoutReport";
import type {
  ScoutingCandidateInsight,
  ScoutingCandidatePool,
  ScoutingCandidateTruth,
} from "../data/ScoutingStore";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const gameData = gameDataBootstrap.data;
const CANDIDATE_COUNT = 6;

function achievementForTier(
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

function recentSeasonRating(state: GameState): number {
  const school = state.schools[state.userSchoolId];
  const ratings = school?.history.recentSeasonRatings ?? [];
  return ratings.at(-1) ?? 50;
}

function defaultExcludedFullNames(state: GameState): Set<string> {
  return new Set(
    Object.values(state.players).map(
      (player) => `${player.lastName} ${player.firstName}`,
    ),
  );
}

function scoutingGenerationRandom(state: GameState): SeededRandom {
  return new SeededRandom(`${state.seed}:scouting:${scoutingCycleKey(state)}`);
}

function scoutingTierProbabilities(state: GameState) {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error("user school is missing");
  }

  return calculateRecruitTierProbabilities({
    reputationPoints: school.reputationPoints,
    coachScouting: school.coach.scouting,
    scoutingNetworkLevel: school.facilities.scoutingNetwork,
    dormitoryLevel: school.facilities.dormitory,
    recentSeasonRating: recentSeasonRating(state),
  });
}

export function scoutingCycleKey(state: GameState): string {
  return `${state.userSchoolId}:year-${state.yearIndex}`;
}

export function generateServerScoutingCandidateAtIndex(
  state: GameState,
  index: number,
  excludedFullNames: ReadonlySet<string> = defaultExcludedFullNames(state),
): ScoutingCandidateTruth {
  if (!Number.isSafeInteger(index) || index < 1) {
    throw new Error("scouting candidate index must be a positive integer");
  }

  const random = scoutingGenerationRandom(state);
  const probabilities = scoutingTierProbabilities(state);
  const exclusions = new Set(excludedFullNames);
  let candidate: ScoutingCandidateTruth | null = null;

  for (let currentIndex = 1; currentIndex <= index; currentIndex += 1) {
    const tier = selectRecruitTier(probabilities, random);
    const player = generatePlayer({
      id: playerId(
        `scout-${state.userSchoolId}-${state.yearIndex}-${currentIndex}`,
      ),
      schoolId: state.userSchoolId,
      grade: 1,
      enrolledYear: state.yearIndex + 1,
      tier,
      data: gameData,
      random,
      excludedFullNames: exclusions,
    });

    candidate = {
      player,
      middleSchoolAchievement: achievementForTier(tier, random),
    };
  }

  if (!candidate) {
    throw new Error("scouting candidate generation failed");
  }
  return candidate;
}

export function generateServerScoutingCandidates(
  state: GameState,
): ScoutingCandidateTruth[] {
  const excludedFullNames = defaultExcludedFullNames(state);
  return Array.from({ length: CANDIDATE_COUNT }, (_, index) =>
    generateServerScoutingCandidateAtIndex(
      state,
      index + 1,
      excludedFullNames,
    ),
  );
}

export function buildServerScoutReports(
  state: GameState,
  pool: ScoutingCandidatePool,
  insights: readonly ScoutingCandidateInsight[] = [],
): ScoutReport[] {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error("user school is missing");
  }

  const insightsByCandidateId = new Map(
    insights.map((insight) => [insight.candidateId, insight] as const),
  );

  return pool.candidates.map((candidate) => {
    const insight = insightsByCandidateId.get(candidate.player.id);
    const overallPrecision = insight?.overallPrecision ?? "normal";
    const potentialPrecision = insight?.potentialPrecision ?? "normal";
    const random = new SeededRandom(
      [
        state.seed,
        "scout-report",
        pool.cycleKey,
        candidate.player.id,
        school.coach.observation,
        school.facilities.scoutingNetwork,
        overallPrecision,
        potentialPrecision,
      ].join(":"),
    );

    return createScoutReport({
      player: candidate.player,
      middleSchoolAchievement: candidate.middleSchoolAchievement,
      observation: school.coach.observation,
      scoutingNetworkLevel: school.facilities.scoutingNetwork,
      overallPrecision,
      potentialPrecision,
      random,
    });
  });
}
