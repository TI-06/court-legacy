import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";

describe("Phase17 season goal rollover", () => {
  it("archives the completed season and creates next-year goals", () => {
    const state = createDemoGame();
    expect(state.seasonGoals?.yearIndex).toBe(1);
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;
    const completedGoals = structuredClone(state.seasonGoals!);

    const result = advanceGameWeek(state, gameData);
    const archived = result.state.history.seasonGoalSeasons?.at(-1);
    const nextGoals = result.state.seasonGoals;
    const nextUserSchool = result.state.schools[result.state.userSchoolId]!;

    expect(result.academicYearTransition).not.toBeNull();
    expect(archived?.yearIndex).toBe(completedGoals.yearIndex);
    expect(archived?.academicYear).toBe(completedGoals.academicYear);
    expect(nextGoals?.yearIndex).toBe(2);
    expect(nextGoals?.academicYear).toBe(2);
    expect(nextGoals?.baseline).toMatchObject({
      officialWins: nextUserSchool.history.officialWins,
      prefecturalTitles: nextUserSchool.history.prefecturalTitles,
      nationalAppearances: nextUserSchool.history.nationalAppearances,
      nationalTitles: nextUserSchool.history.nationalTitles,
    });
  });

  it("starts Phase17 cleanly when an old v8 save had no season goals", () => {
    const state = createDemoGame();
    state.seasonGoals = undefined;
    state.history.seasonGoalSeasons = undefined;
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;

    const result = advanceGameWeek(state, gameData);

    expect(result.academicYearTransition).not.toBeNull();
    expect(result.state.history.seasonGoalSeasons).toBeUndefined();
    expect(result.state.seasonGoals?.yearIndex).toBe(2);
  });
});
