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

      if (awards.length === 0 || awards.length > 6) {
        throw new Error(
          `Phase55 award count out of bounds: calendarYear=${calendarYear} academicYear=${state.calendar.academicYear} count=${awards.length}`,
        );
      }
      awardedAcrossYears += awards.length;
      state = result.state;
    }

    const seasonAwardIds = Object.values(state.players).flatMap((player) =>
      player.career.awardIds.filter((awardId) => awardId.startsWith("season:")),
    );

    if (seasonAwardIds.length !== awardedAcrossYears) {
      throw new Error(
        `Phase55 award persistence mismatch: persisted=${seasonAwardIds.length} awarded=${awardedAcrossYears}`,
      );
    }
    if (seasonAwardIds.length > 30 * 6) {
      throw new Error(
        `Phase55 total award bound exceeded: persisted=${seasonAwardIds.length}`,
      );
    }

    for (const player of Object.values(state.players)) {
      const awards = player.career.awardIds.filter((awardId) =>
        awardId.startsWith("season:"),
      );
      if (new Set(awards).size !== awards.length) {
        throw new Error(
          `Phase55 duplicate award ids: playerId=${player.id} awards=${awards.join(",")}`,
        );
      }
      if (awards.length > 18) {
        throw new Error(
          `Phase55 player award bound exceeded: playerId=${player.id} count=${awards.length}`,
        );
      }
    }
  });
});
