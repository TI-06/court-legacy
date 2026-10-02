import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";
import type { GameDate } from "../../../../src/domain/model/identifiers";

function seedOfficialSeasonStats(
  state: ReturnType<typeof createDemoGame>,
): void {
  const school = state.schools[state.userSchoolId]!;
  school.playerIds.forEach((playerId, index) => {
    const player = state.players[playerId]!;
    const attackAttempts = 12 + index;
    const receiveAttempts = 10 + index;
    player.career.seasonStats = {
      academicYear: state.calendar.academicYear,
      appearances: 6,
      setsPlayed: 14,
      points: 18 + index * 2,
      attackPoints: 8 + index,
      attackAttempts,
      blocks: 1 + (index % 6),
      serviceAces: 1 + (index % 5),
      receiveAttempts,
      perfectReceives: Math.min(receiveAttempts, 5 + index),
      defensePoints: 2 + (index % 4),
      idealSets: player.preferredPosition === "S" ? 20 + index : 0,
      successfulDigs: 3 + (index % 6),
    };
  });
}

describe("Phase55 annual awards long-run", () => {
  it("keeps 30 seasons of annual awards deterministic and bounded", () => {
    let state = createDemoGame();
    let awardedAcrossYears = 0;

    for (let calendarYear = 2027; calendarYear <= 2056; calendarYear += 1) {
      seedOfficialSeasonStats(state);
      const rolloverDate = `${calendarYear}-03-31` as GameDate;
      state = {
        ...state,
        date: rolloverDate,
        calendar: {
          ...state.calendar,
          currentDate: rolloverDate,
          weekOfYear: 52,
        },
      };

      const result = advanceGameWeek(state, gameData);
      const awards = result.academicYearTransition?.seasonAwards.winners ?? [];

      expect(awards.length).toBeGreaterThan(0);
      expect(awards.length).toBeLessThanOrEqual(6);
      awardedAcrossYears += awards.length;
      state = result.state;
    }

    const seasonAwardIds = Object.values(state.players).flatMap((player) =>
      player.career.awardIds.filter((awardId) =>
        awardId.startsWith("season:"),
      ),
    );

    expect(seasonAwardIds).toHaveLength(awardedAcrossYears);
    expect(seasonAwardIds.length).toBeLessThanOrEqual(30 * 6);

    for (const player of Object.values(state.players)) {
      const awards = player.career.awardIds.filter((awardId) =>
        awardId.startsWith("season:"),
      );
      expect(new Set(awards).size).toBe(awards.length);
      expect(awards.length).toBeLessThanOrEqual(18);
    }
  });
});
