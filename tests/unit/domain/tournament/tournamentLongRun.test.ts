import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceAcademicYear } from "../../../../src/domain/calendar/academicYearProgression";
import type { GameState } from "../../../../src/domain/model/GameState";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import {
  advanceOfficialTournamentsThroughWeek,
  completeTournamentMatch,
  findDueUserOfficialMatch,
} from "../../../../src/domain/tournament/progressOfficialTournaments";
import { MAX_OFFICIAL_TOURNAMENT_HISTORY } from "../../../../src/domain/tournament/tournamentHistory";
import { MAX_MATCH_HISTORY } from "../../../../src/domain/world/rivalWorldProgression";

const TOURNAMENT_WEEKS = [
  9, 10, 11, 12, 16, 17, 18, 19, 30, 31, 32, 33, 41, 42, 43, 44,
] as const;

function atWeek(state: GameState, weekOfYear: number): GameState {
  return {
    ...state,
    calendar: {
      ...state.calendar,
      weekOfYear,
    },
  };
}

function resolveUserMatch(state: GameState, userWins: boolean): GameState {
  const due = findDueUserOfficialMatch(state);
  if (!due) {
    return state;
  }

  const userEntrantId = due.userEntrant.entrantId;
  const opponentEntrantId =
    due.match.homeEntrantId === userEntrantId
      ? due.match.awayEntrantId
      : due.match.homeEntrantId;
  if (!opponentEntrantId) {
    throw new Error("long-run official match is missing its opponent");
  }

  const userIsHome = due.match.homeEntrantId === userEntrantId;
  const winnerEntrantId = userWins ? userEntrantId : opponentEntrantId;
  const homeWon = userWins ? userIsHome : !userIsHome;

  return completeTournamentMatch({
    state,
    circuit: due.circuit,
    level: due.level,
    matchId: due.match.id,
    winnerEntrantId,
    homeSetsWon: homeWon ? 2 : 0,
    awaySetsWon: homeWon ? 0 : 2,
  });
}

function resolveCurrentSeason(state: GameState): GameState {
  const academicYear = state.officialSeason.academicYear;
  const userWinsThisYear = academicYear % 2 === 1;
  let next = state;

  for (const week of TOURNAMENT_WEEKS) {
    next = advanceOfficialTournamentsThroughWeek(atWeek(next, week));
    for (let guard = 0; guard < 4; guard += 1) {
      const due = findDueUserOfficialMatch(next);
      if (!due) break;
      next = resolveUserMatch(next, userWinsThisYear);
      next = advanceOfficialTournamentsThroughWeek(next);
    }
  }

  const stages = [
    next.officialSeason.interhigh.prefectural,
    next.officialSeason.interhigh.national,
    next.officialSeason.springHigh.prefectural,
    next.officialSeason.springHigh.national,
  ];
  if (stages.some((stage) => !stage?.championEntrantId)) {
    throw new Error(`official tournament season ${academicYear} did not finish`);
  }
  if (findDueUserOfficialMatch(next)) {
    throw new Error(`official tournament season ${academicYear} is stuck`);
  }

  return next;
}

function runYears(years: number): GameState {
  let state = createDemoGame();
  for (let index = 0; index < years; index += 1) {
    const academicYear = state.officialSeason.academicYear;
    state = resolveCurrentSeason(state);
    const summaries = state.history.officialTournaments.filter(
      (summary) => summary.academicYear === academicYear,
    );
    if (summaries.length !== 4) {
      throw new Error(
        `academic year ${academicYear} archived ${summaries.length} stages instead of 4`,
      );
    }

    const random = new SeededRandom(state.seed, state.randomCursor);
    state = advanceAcademicYear(state, gameData, random).state;
  }
  return state;
}

function deterministicSnapshot(state: GameState) {
  return {
    academicYear: state.calendar.academicYear,
    officialHistory: state.history.officialTournaments,
    schoolRecords: Object.values(state.schools)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((school) => ({
        id: school.id,
        officialWins: school.history.officialWins,
        officialLosses: school.history.officialLosses,
        prefecturalTitles: school.history.prefecturalTitles,
        nationalAppearances: school.history.nationalAppearances,
        nationalTitles: school.history.nationalTitles,
      })),
  };
}

describe("official tournament long-run soak", () => {
  it("produces the same complete two-circuit tournament history for 30 years", () => {
    const first = runYears(30);
    const second = runYears(30);

    expect(deterministicSnapshot(first)).toEqual(deterministicSnapshot(second));
    expect(first.history.officialTournaments).toHaveLength(30 * 4);
    expect(
      new Set(first.history.officialTournaments.map((summary) => summary.academicYear))
        .size,
    ).toBe(30);
    expect(
      first.history.officialTournaments.every(
        (summary) =>
          summary.circuit === "interhigh" || summary.circuit === "spring-high",
      ),
    ).toBe(true);
  });

  it("keeps a 100-year tournament world bounded without persisting guest schools or players", () => {
    const initial = createDemoGame();
    const state = runYears(100);

    expect(state.calendar.academicYear).toBe(initial.calendar.academicYear + 100);
    expect(state.officialSeason.academicYear).toBe(state.calendar.academicYear);
    expect(state.history.officialTournaments).toHaveLength(
      MAX_OFFICIAL_TOURNAMENT_HISTORY,
    );
    expect(state.history.matches.length).toBeLessThanOrEqual(MAX_MATCH_HISTORY);
    expect(Object.keys(state.schools).some((id) => id.includes("guest:"))).toBe(
      false,
    );
    expect(Object.keys(state.players).some((id) => id.includes("guest:"))).toBe(
      false,
    );
    expect(state.officialSeason.interhigh.national).toBeNull();
    expect(state.officialSeason.springHigh.national).toBeNull();
    expect(state.officialSeason.interhigh.prefectural.tournamentId).toContain(
      `:${state.calendar.academicYear}:`,
    );
    expect(state.officialSeason.springHigh.prefectural.tournamentId).toContain(
      `:${state.calendar.academicYear}:`,
    );
  });
});
