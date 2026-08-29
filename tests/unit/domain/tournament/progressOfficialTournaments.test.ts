import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import type { GameState } from "../../../../src/domain/model/GameState";
import {
  advanceOfficialTournamentsThroughWeek,
  completeTournamentMatch,
  findDueUserOfficialMatch,
  hasRequiredOfficialMatch,
} from "../../../../src/domain/tournament/progressOfficialTournaments";
import {
  MAX_OFFICIAL_TOURNAMENT_HISTORY,
  appendOfficialTournamentSummary,
} from "../../../../src/domain/tournament/tournamentHistory";
import type {
  TournamentLevel,
  TournamentStageState,
} from "../../../../src/domain/tournament/tournamentTypes";

function createState(seed = "phase6-progression") {
  return createInitialGame({
    seed,
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

function atWeek(state: GameState, weekOfYear: number): GameState {
  return {
    ...state,
    calendar: {
      ...state.calendar,
      weekOfYear,
    },
  };
}

function userEntrantId(state: GameState, stage: TournamentStageState): string {
  const entrant = stage.entrants.find(
    (candidate) =>
      candidate.source === "world-school" &&
      candidate.schoolId === state.userSchoolId,
  );
  if (!entrant) {
    throw new Error("user entrant missing");
  }
  return entrant.entrantId;
}

function playDueUserWin(
  state: GameState,
  weekOfYear: number,
  level: TournamentLevel,
): GameState {
  let next = advanceOfficialTournamentsThroughWeek(atWeek(state, weekOfYear));
  const due = findDueUserOfficialMatch(next);
  if (!due || due.level !== level) {
    throw new Error(`expected due ${level} match in week ${weekOfYear}`);
  }

  const userId = userEntrantId(next, due.stage);
  const isHome = due.match.homeEntrantId === userId;
  return completeTournamentMatch({
    state: next,
    circuit: due.circuit,
    level: due.level,
    matchId: due.match.id,
    winnerEntrantId: userId,
    homeSetsWon: isHome ? 2 : 0,
    awaySetsWon: isHome ? 0 : 2,
  });
}

describe("official tournament progression", () => {
  it("resolves due NPC matches but leaves the due user match required", () => {
    const state = advanceOfficialTournamentsThroughWeek(atWeek(createState(), 9));
    const stage = state.officialSeason.interhigh.prefectural;
    const userId = userEntrantId(state, stage);
    const openingMatches = stage.matches.filter(
      (match) => match.round === "round-of-16",
    );
    const userMatch = openingMatches.find(
      (match) =>
        match.homeEntrantId === userId || match.awayEntrantId === userId,
    );

    expect(userMatch?.status).toBe("user-required");
    expect(userMatch?.winnerEntrantId).toBeNull();
    expect(
      openingMatches
        .filter((match) => match.id !== userMatch?.id)
        .every((match) => match.status === "completed"),
    ).toBe(true);
    expect(hasRequiredOfficialMatch(state)).toBe(true);
    expect(findDueUserOfficialMatch(state)?.match.id).toBe(userMatch?.id);
  });

  it("stops future user gates after elimination while NPCs finish the stage", () => {
    let state = advanceOfficialTournamentsThroughWeek(atWeek(createState(), 9));
    const due = findDueUserOfficialMatch(state);
    if (!due) {
      throw new Error("opening user match missing");
    }
    const userId = userEntrantId(state, due.stage);
    const opponentId =
      due.match.homeEntrantId === userId
        ? due.match.awayEntrantId
        : due.match.homeEntrantId;
    if (!opponentId) {
      throw new Error("opening opponent missing");
    }
    const userIsHome = due.match.homeEntrantId === userId;

    state = completeTournamentMatch({
      state,
      circuit: due.circuit,
      level: due.level,
      matchId: due.match.id,
      winnerEntrantId: opponentId,
      homeSetsWon: userIsHome ? 0 : 2,
      awaySetsWon: userIsHome ? 2 : 0,
    });
    state = advanceOfficialTournamentsThroughWeek(atWeek(state, 12));

    expect(state.officialSeason.interhigh.prefectural.userEliminated).toBe(true);
    expect(state.officialSeason.interhigh.prefectural.userBestRound).toBe(
      "round-of-16",
    );
    expect(hasRequiredOfficialMatch(state)).toBe(false);
    expect(state.officialSeason.interhigh.prefectural.championEntrantId).not.toBe(
      null,
    );
    expect(state.officialSeason.interhigh.national?.entrants).toHaveLength(16);
  });

  it("awards a prefectural title and national appearance exactly once", () => {
    let state = createState("phase6-user-pref-title");
    for (const week of [9, 10, 11, 12]) {
      state = playDueUserWin(state, week, "prefectural");
    }

    const userSchool = state.schools[state.userSchoolId]!;
    expect(state.officialSeason.interhigh.prefectural.championEntrantId).toBe(
      userEntrantId(state, state.officialSeason.interhigh.prefectural),
    );
    expect(userSchool.history.prefecturalTitles).toBe(1);
    expect(userSchool.history.nationalAppearances).toBe(1);
    expect(state.officialSeason.interhigh.national?.entrants).toHaveLength(16);
    expect(
      state.history.officialTournaments.filter(
        (summary) =>
          summary.circuit === "interhigh" && summary.level === "prefectural",
      ),
    ).toHaveLength(1);

    const replay = advanceOfficialTournamentsThroughWeek(state);
    expect(replay.schools[state.userSchoolId]!.history.prefecturalTitles).toBe(1);
    expect(replay.schools[state.userSchoolId]!.history.nationalAppearances).toBe(
      1,
    );
    expect(
      replay.history.officialTournaments.filter(
        (summary) =>
          summary.circuit === "interhigh" && summary.level === "prefectural",
      ),
    ).toHaveLength(1);
  });

  it("lets the user win nationals and records the national title once", () => {
    let state = createState("phase6-user-national-title");
    for (const week of [9, 10, 11, 12]) {
      state = playDueUserWin(state, week, "prefectural");
    }
    for (const week of [16, 17, 18, 19]) {
      state = playDueUserWin(state, week, "national");
    }

    expect(state.schools[state.userSchoolId]!.history.nationalTitles).toBe(1);
    expect(state.officialSeason.interhigh.national?.championEntrantId).toBe(
      userEntrantId(state, state.officialSeason.interhigh.national!),
    );
    expect(
      state.history.officialTournaments.filter(
        (summary) => summary.circuit === "interhigh",
      ),
    ).toHaveLength(2);

    const replay = advanceOfficialTournamentsThroughWeek(state);
    expect(replay.schools[state.userSchoolId]!.history.nationalTitles).toBe(1);
  });

  it("bounds canonical tournament history while keeping the newest summary", () => {
    let state = createState("phase6-history-bound");
    for (const week of [9, 10, 11, 12]) {
      state = playDueUserWin(state, week, "prefectural");
    }
    const stage = state.officialSeason.interhigh.prefectural;
    const currentSummary = state.history.officialTournaments.at(-1)!;
    state = {
      ...state,
      history: {
        ...state.history,
        officialTournaments: Array.from(
          { length: MAX_OFFICIAL_TOURNAMENT_HISTORY },
          (_, index) => ({
            ...currentSummary,
            tournamentId: `archived:${index}`,
          }),
        ),
      },
    };

    const appended = appendOfficialTournamentSummary(state, stage);

    expect(appended.history.officialTournaments).toHaveLength(
      MAX_OFFICIAL_TOURNAMENT_HISTORY,
    );
    expect(appended.history.officialTournaments.at(-1)?.tournamentId).toBe(
      stage.tournamentId,
    );
  });
});
