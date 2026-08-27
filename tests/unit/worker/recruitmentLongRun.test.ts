import { createDemoGame, gameData } from "../../../src/app/createDemoGame";
import { advanceAcademicYear } from "../../../src/domain/calendar/academicYearProgression";
import { SeededRandom } from "../../../src/domain/random/SeededRandom";
import {
  generateServerScoutingCandidates,
  scoutingCycleKey,
} from "../../../worker/scouting/serverScoutingBoard";

describe("recruitment long-run soak", () => {
  it("keeps annual scouting, enrollment, graduation, and roster bounds stable for 30 years", () => {
    let state = createDemoGame();
    const recruitedIds = new Set<string>();

    for (let year = 0; year < 30; year += 1) {
      const candidates = generateServerScoutingCandidates(state);
      const recruit = candidates[0]!;
      const cycleKey = scoutingCycleKey(state);

      expect(recruitedIds.has(recruit.player.id)).toBe(false);
      state = {
        ...state,
        recruiting: {
          cycleKey,
          committedCandidateIds: [recruit.player.id],
        },
      };

      const random = new SeededRandom(state.seed, state.randomCursor);
      const result = advanceAcademicYear(state, gameData, random, {
        userIntake: [recruit.player],
      });
      state = result.state;
      recruitedIds.add(recruit.player.id);

      const school = state.schools[state.userSchoolId]!;
      expect(school.playerIds).toContain(recruit.player.id);
      expect(state.players[recruit.player.id]?.grade).toBe(1);
      expect(state.players[recruit.player.id]?.career.schoolId).toBe(
        state.userSchoolId,
      );
      expect(state.recruiting).toBeUndefined();
      expect(school.playerIds.length).toBeGreaterThanOrEqual(12);
      expect(school.playerIds.length).toBeLessThanOrEqual(16);
      expect(new Set(school.playerIds).size).toBe(school.playerIds.length);
    }

    expect(recruitedIds.size).toBe(30);
    expect(state.yearIndex).toBe(31);
  });
});
