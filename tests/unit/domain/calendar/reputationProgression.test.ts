import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";

describe("academic year reputation progression", () => {
  it("updates school reputation history before the new season starts", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;
    state.schools[state.userSchoolId] = {
      ...school,
      reputationPoints: 760,
      history: {
        ...school.history,
        officialWins: 18,
        officialLosses: 4,
        prefecturalTitles: 1,
        nationalAppearances: 1,
        recentSeasonRatings: [72, 75, 79],
        peakReputationPoints: 760,
      },
    };

    const result = advanceGameWeek(state, gameData);
    const updated = result.state.schools[state.userSchoolId]!;

    expect(updated.reputationPoints).toBeGreaterThan(760);
    expect(updated.history.recentSeasonRatings).toHaveLength(4);
    expect(updated.history.peakReputationPoints).toBe(updated.reputationPoints);
  });
});
