import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";

describe("Phase 14 development priorities across academic-year rollover", () => {
  it("removes graduated players while keeping returning priorities", () => {
    const state = createDemoGame();
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;

    const userSchool = state.schools[state.userSchoolId]!;
    const graduatingPlayerId = userSchool.playerIds.find(
      (playerId) => state.players[playerId]!.grade === 3,
    )!;
    const returningPlayerId = userSchool.playerIds.find(
      (playerId) => state.players[playerId]!.grade !== 3,
    )!;

    state.teamPlanning = {
      ...state.teamPlanning,
      developmentPriorityPlayerIds: [graduatingPlayerId, returningPlayerId],
    };

    const result = advanceGameWeek(state, gameData);

    expect(result.academicYearTransition).not.toBeNull();
    expect(result.state.teamPlanning.developmentPriorityPlayerIds).toEqual([
      returningPlayerId,
    ]);
  });
});
