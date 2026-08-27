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
  buildScoutingBoard,
  type MiddleSchoolAchievement,
  type ScoutReport,
} from "../../src/domain/scouting/scoutReport";
import type {
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

export function scoutingCycleKey(state: GameState): string {
  return `${state.userSchoolId}:year-${state.yearIndex}`;
}

export function generateServerScoutingCandidates(
  state: GameState,
): ScoutingCandidateTruth[] {
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
    recentSeasonRating: recentSeasonRating(state),
  });
  const excludedFullNames = new Set(
    Object.values(state.players).map(
      (player) => `${player.lastName} ${player.firstName}`,
    ),
  );

  return Array.from({ length: CANDIDATE_COUNT }, (_, index) => {
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
      middleSchoolAchievement: achievementForTier(tier, random),
    };
  });
}

export function buildServerScoutReports(
  state: GameState,
  pool: ScoutingCandidatePool,
): ScoutReport[] {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error("user school is missing");
  }

  return buildScoutingBoard({
    candidates: pool.candidates,
    observation: school.coach.observation,
    scoutingNetworkLevel: school.facilities.scoutingNetwork,
    random: new SeededRandom(
      `${state.seed}:scout-report:${pool.cycleKey}:${school.coach.observation}:${school.facilities.scoutingNetwork}`,
    ),
  });
}
