import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";
import { findDueUserOfficialMatch } from "../../../../src/domain/tournament/progressOfficialTournaments";

function createState() {
  return createInitialGame({
    seed: "official-week-progression",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高橋 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
}

describe("official tournament week progression", () => {
  it("marks the user's official match due when advancing into its scheduled week", () => {
    if (!gameDataBootstrap.ok) {
      throw new Error(gameDataBootstrap.message);
    }
    const state = createState();
    const weekEight = {
      ...state,
      calendar: {
        ...state.calendar,
        weekOfYear: 8,
      },
    };

    const advanced = advanceGameWeek(weekEight, gameDataBootstrap.data);

    expect(advanced.state.calendar.weekOfYear).toBe(9);
    const due = findDueUserOfficialMatch(advanced.state);
    expect(due).not.toBeNull();
    expect(due?.match.scheduledWeek).toBe(9);
  });
});
