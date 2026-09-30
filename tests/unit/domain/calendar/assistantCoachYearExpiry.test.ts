import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";

describe("assistant coach annual contract", () => {
  it("expires the assistant coach when the academic year changes", () => {
    const state = createDemoGame();
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;
    state.schoolManagement.assistantCoach = {
      rank: "advanced",
      specialty: "attack",
      contractYearIndex: state.yearIndex,
    };

    const result = advanceGameWeek(state, gameData);

    expect(result.academicYearTransition).not.toBeNull();
    expect(result.state.yearIndex).toBe(state.yearIndex + 1);
    expect(result.state.schoolManagement.assistantCoach).toBeNull();
  });

  it("resets annual development investments when the academic year changes", () => {
    const state = createDemoGame();
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;
    state.schoolManagement.annualInvestment = {
      yearIndex: state.yearIndex,
      trainingLevel: 3,
      specialistLevel: 2,
      campLevel: 3,
      scoutingLevel: 1,
      specialistFocus: "defense",
    };

    const result = advanceGameWeek(state, gameData);

    expect(result.academicYearTransition).not.toBeNull();
    expect(result.state.schoolManagement.annualInvestment).toEqual({
      yearIndex: state.yearIndex + 1,
      trainingLevel: 0,
      specialistLevel: 0,
      campLevel: 0,
      scoutingLevel: 0,
      specialistFocus: null,
    });
  });
});
