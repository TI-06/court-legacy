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

function runThirtyAwardSeasons() {
  let state = createDemoGame();
  const awardedSignatures: string[] = [];

  for (let calendarYear = 2027; calendarYear <= 2056; calendarYear += 1) {
    seedOfficialSeasonStats(state);
    const completedAcademicYear = state.calendar.academicYear;
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
        `Phase55 award count out of bounds: calendarYear=${calendarYear} academicYear=${completedAcademicYear} count=${awards.length}`,
      );
    }

    for (const award of awards) {
      awardedSignatures.push(
        `${completedAcademicYear}:${award.category}:${award.playerId}`,
      );
    }

    state = result.state;
  }

  return { state, awardedSignatures };
}

describe("Phase55 annual awards long-run", () => {
  it("keeps 30 seasons of annual awards deterministic and bounded", () => {
    const first = runThirtyAwardSeasons();
    const second = runThirtyAwardSeasons();

    expect(second.awardedSignatures).toEqual(first.awardedSignatures);
    expect(first.awardedSignatures.length).toBeLessThanOrEqual(30 * 6);
    expect(new Set(first.awardedSignatures).size).toBe(
      first.awardedSignatures.length,
    );

    const retainedAwardIds = Object.values(first.state.players).flatMap(
      (player) =>
        player.career.awardIds.filter((awardId) =>
          awardId.startsWith("season:"),
        ),
    );

    // Old alumni Player records are intentionally compacted from long saves.
    // Only the bounded retained-player window must keep valid, duplicate-free
    // award ids; the 30-year generated total is verified above before compaction.
    expect(retainedAwardIds.length).toBeLessThanOrEqual(
      first.awardedSignatures.length,
    );
    expect(new Set(retainedAwardIds).size).toBe(retainedAwardIds.length);

    for (const player of Object.values(first.state.players)) {
      const awards = player.career.awardIds.filter((awardId) =>
        awardId.startsWith("season:"),
      );
      expect(awards.length).toBeLessThanOrEqual(18);

      for (const awardId of awards) {
        const match = /^season:(\d+):/.exec(awardId);
        expect(match).not.toBeNull();
        const academicYear = Number(match?.[1]);
        expect(academicYear).toBeGreaterThanOrEqual(player.career.enrolledYear);
        expect(academicYear).toBeLessThanOrEqual(
          player.career.enrolledYear + 2,
        );
      }
    }
  });
});
