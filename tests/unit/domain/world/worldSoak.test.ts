import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceAcademicYear } from "../../../../src/domain/calendar/academicYearProgression";
import type { GameState } from "../../../../src/domain/model/GameState";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import {
  MAX_ALUMNI_PER_SCHOOL,
  MAX_GENERATIONAL_TALENTS,
  MAX_GRADUATE_HISTORY,
} from "../../../../src/domain/world/rivalWorldProgression";

function runYears(years: number): GameState {
  let state = createDemoGame();
  for (let year = 0; year < years; year += 1) {
    const random = new SeededRandom(state.seed, state.randomCursor);
    state = advanceAcademicYear(state, gameData, random).state;
  }
  return state;
}

function worldSnapshot(state: GameState) {
  return Object.values(state.schools)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((school) => ({
      id: school.id,
      reputation: school.reputation,
      reputationPoints: school.reputationPoints,
      funds: school.funds,
      facilities: school.facilities,
      recentSeasonRatings: school.history.recentSeasonRatings,
      playerAbilities: school.playerIds.map(
        (playerId) => state.players[playerId]!.abilities,
      ),
    }));
}

describe("rival world long-run soak", () => {
  it("produces the same 30-year world from the same seed", () => {
    expect(worldSnapshot(runYears(30))).toEqual(worldSnapshot(runYears(30)));
  });

  it("keeps a 100-year world bounded and varied", () => {
    const state = runYears(100);
    const reputationPoints = Object.values(state.schools).map(
      (school) => school.reputationPoints,
    );
    const activePlayerIds = new Set(
      Object.values(state.schools).flatMap((school) => school.playerIds),
    );
    const retainedAlumniIds = new Set(
      Object.values(state.schools).flatMap((school) => school.alumniPlayerIds),
    );

    for (const school of Object.values(state.schools)) {
      expect(school.playerIds.length).toBeGreaterThanOrEqual(12);
      expect(school.playerIds.length).toBeLessThanOrEqual(16);
      expect(school.alumniPlayerIds.length).toBeLessThanOrEqual(
        MAX_ALUMNI_PER_SCHOOL,
      );
      expect(school.history.recentSeasonRatings?.length ?? 0).toBeLessThanOrEqual(
        3,
      );
      expect(school.reputationPoints).toBeGreaterThanOrEqual(0);
      expect(school.reputationPoints).toBeLessThanOrEqual(1000);
    }

    expect(state.history.graduates.length).toBeLessThanOrEqual(
      MAX_GRADUATE_HISTORY,
    );
    expect(state.world.generationalTalentPlayerIds.length).toBeLessThanOrEqual(
      MAX_GENERATIONAL_TALENTS,
    );
    expect(Object.keys(state.players).length).toBeLessThanOrEqual(
      activePlayerIds.size + retainedAlumniIds.size,
    );
    expect(Math.max(...reputationPoints) - Math.min(...reputationPoints)).toBeGreaterThan(
      100,
    );
  });
});
