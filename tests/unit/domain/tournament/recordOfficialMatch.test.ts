import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import type { GameState } from "../../../../src/domain/model/GameState";
import type {
  MatchEvent,
  MatchState,
} from "../../../../src/domain/model/Match";
import { matchId, schoolId } from "../../../../src/domain/model/identifiers";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { materializeGuestOpponent } from "../../../../src/domain/tournament/materializeGuestOpponent";
import {
  improveBestTournamentResultId,
  tournamentResultIdForMatch,
} from "../../../../src/domain/tournament/playerTournamentStats";
import { recordOfficialTournamentOutcome } from "../../../../src/domain/tournament/recordOfficialMatch";
import type {
  GuestTournamentEntrant,
  TournamentStageState,
  WorldSchoolTournamentEntrant,
} from "../../../../src/domain/tournament/tournamentTypes";

function createState(seed = "phase6-official-recording") {
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

function data() {
  if (!gameDataBootstrap.ok) {
    throw new Error(gameDataBootstrap.message);
  }
  return gameDataBootstrap.data;
}

function guest(): GuestTournamentEntrant {
  return {
    entrantId: "guest:interhigh:1:final",
    source: "guest-representative",
    displayName: "星陵学院",
    shortName: "星陵",
    regionLabel: "東海地区",
    guestSeed: "phase6-recording-guest",
    seedStrength: 86,
  };
}

function configureNationalFinal(state: GameState) {
  const userSchool = state.schools[state.userSchoolId]!;
  const userEntrant: WorldSchoolTournamentEntrant = {
    entrantId: `world:${userSchool.id}`,
    source: "world-school",
    schoolId: userSchool.id,
    displayName: userSchool.name,
    shortName: userSchool.shortName,
    seedStrength: 84,
  };
  const guestEntrant = guest();
  const bracketMatchId = "official:interhigh:1:national:final:0";
  const stage: TournamentStageState = {
    tournamentId: "official:interhigh:1:national",
    circuit: "interhigh",
    level: "national",
    entrants: [userEntrant, guestEntrant],
    matches: [
      {
        id: bracketMatchId,
        round: "final",
        roundIndex: 3,
        slotIndex: 0,
        scheduledWeek: 19,
        homeEntrantId: userEntrant.entrantId,
        awayEntrantId: guestEntrant.entrantId,
        winnerEntrantId: null,
        homeSetsWon: null,
        awaySetsWon: null,
        status: "user-required",
      },
    ],
    championEntrantId: null,
    userEliminated: false,
    userBestRound: "semifinal",
  };

  return {
    state: {
      ...state,
      officialSeason: {
        ...state.officialSeason,
        interhigh: {
          ...state.officialSeason.interhigh,
          national: stage,
        },
      },
    },
    guestEntrant,
    bracketMatchId,
  };
}

function completedMatch(
  state: GameState,
  bracketMatchId: string,
  guestEntrant: GuestTournamentEntrant,
): MatchState {
  const homeSelection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const materialized = materializeGuestOpponent({
    state,
    entrant: guestEntrant,
    data: data(),
  });
  const starters = homeSelection.rotation.map(
    (assignment) => assignment.playerId,
  );
  const first = starters[0]!;
  const second = starters[1]!;
  const third = starters[2]!;
  const pointEvents: MatchEvent[] = [
    {
      sequence: 1,
      type: "point",
      setNumber: 1,
      homeScore: 1,
      awayScore: 0,
      actorPlayerId: first,
      targetPlayerId: null,
      winnerSchoolId: state.userSchoolId,
      detailCode: "point.attack",
    },
    {
      sequence: 2,
      type: "point",
      setNumber: 1,
      homeScore: 2,
      awayScore: 0,
      actorPlayerId: second,
      targetPlayerId: null,
      winnerSchoolId: state.userSchoolId,
      detailCode: "point.block",
    },
    {
      sequence: 3,
      type: "point",
      setNumber: 2,
      homeScore: 1,
      awayScore: 0,
      actorPlayerId: third,
      targetPlayerId: null,
      winnerSchoolId: state.userSchoolId,
      detailCode: "point.serve-ace",
    },
    {
      sequence: 4,
      type: "point",
      setNumber: 3,
      homeScore: 1,
      awayScore: 0,
      actorPlayerId: first,
      targetPlayerId: null,
      winnerSchoolId: state.userSchoolId,
      detailCode: "point.defense",
    },
  ];

  return {
    id: matchId(bracketMatchId),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: materialized.school.id,
    homeSelection,
    awaySelection: materialized.selection,
    bestOfSets: 3,
    phase: "match-complete",
    currentSetNumber: 3,
    homeSetsWon: 2,
    awaySetsWon: 1,
    sets: [
      {
        setNumber: 1,
        homeScore: 25,
        awayScore: 20,
        completed: true,
        winnerSchoolId: state.userSchoolId,
      },
      {
        setNumber: 2,
        homeScore: 22,
        awayScore: 25,
        completed: true,
        winnerSchoolId: materialized.school.id,
      },
      {
        setNumber: 3,
        homeScore: 15,
        awayScore: 11,
        completed: true,
        winnerSchoolId: state.userSchoolId,
      },
    ],
    servingSchoolId: state.userSchoolId,
    pendingCoachCommandForSchoolId: null,
    eventLog: pointEvents,
    randomSeed: "phase6-recorded-match",
    randomCursor: 44,
  };
}

describe("recordOfficialTournamentOutcome", () => {
  it("records a guest-safe readable history entry and persistent official result without guest persistence or rivalry", () => {
    const configured = configureNationalFinal(createState());
    const state = configured.state;
    const beforeSchoolCount = Object.keys(state.schools).length;
    const beforePlayerCount = Object.keys(state.players).length;
    const beforeRivalry = structuredClone(state.world.rivalryScores);
    const beforeWins = state.schools[state.userSchoolId]!.history.officialWins;
    const match = completedMatch(
      state,
      configured.bracketMatchId,
      configured.guestEntrant,
    );

    const next = recordOfficialTournamentOutcome({
      state,
      circuit: "interhigh",
      level: "national",
      bracketMatchId: configured.bracketMatchId,
      match,
    });

    expect(next.history.matches).toHaveLength(state.history.matches.length + 1);
    expect(next.history.matches.at(-1)).toMatchObject({
      matchId: match.id,
      homeSchoolId: state.userSchoolId,
      awaySchoolId: match.awaySchoolId,
      homeDisplayName: "青葉高校",
      awayDisplayName: "星陵学院",
      winnerSchoolId: state.userSchoolId,
      tournamentId: "official:interhigh:1:national",
    });
    expect(next.schools[state.userSchoolId]!.history.officialWins).toBe(
      beforeWins + 1,
    );
    expect(Object.keys(next.schools)).toHaveLength(beforeSchoolCount);
    expect(Object.keys(next.players)).toHaveLength(beforePlayerCount);
    expect(next.schools[match.awaySchoolId]).toBeUndefined();
    expect(next.world.rivalryScores).toEqual(beforeRivalry);
  });

  it("accounts appearances, sets, points, blocks, aces, and the best tournament result from the authoritative event log", () => {
    const configured = configureNationalFinal(
      createState("phase6-official-player-stats"),
    );
    const state = configured.state;
    const match = completedMatch(
      state,
      configured.bracketMatchId,
      configured.guestEntrant,
    );
    const starters = match.homeSelection.rotation.map(
      (assignment) => assignment.playerId,
    );
    const liberoId = match.homeSelection.liberoPlayerId!;
    const first = starters[0]!;
    const second = starters[1]!;
    const third = starters[2]!;

    const next = recordOfficialTournamentOutcome({
      state,
      circuit: "interhigh",
      level: "national",
      bracketMatchId: configured.bracketMatchId,
      match,
    });

    for (const playerId of [...starters, liberoId]) {
      expect(next.players[playerId]!.career.appearances).toBe(
        state.players[playerId]!.career.appearances + 1,
      );
      expect(next.players[playerId]!.career.setsPlayed).toBe(
        state.players[playerId]!.career.setsPlayed + 3,
      );
      expect(next.players[playerId]!.career.bestTournamentResultId).toBe(
        "interhigh:national:champion",
      );
    }
    expect(next.players[first]!.career.points).toBe(
      state.players[first]!.career.points + 2,
    );
    expect(next.players[second]!.career.points).toBe(
      state.players[second]!.career.points + 1,
    );
    expect(next.players[second]!.career.blocks).toBe(
      state.players[second]!.career.blocks + 1,
    );
    expect(next.players[third]!.career.points).toBe(
      state.players[third]!.career.points + 1,
    );
    expect(next.players[third]!.career.serviceAces).toBe(
      state.players[third]!.career.serviceAces + 1,
    );
  });

  it("is exactly idempotent when the same completed match is recorded again", () => {
    const configured = configureNationalFinal(
      createState("phase6-official-idempotent"),
    );
    const match = completedMatch(
      configured.state,
      configured.bracketMatchId,
      configured.guestEntrant,
    );
    const first = recordOfficialTournamentOutcome({
      state: configured.state,
      circuit: "interhigh",
      level: "national",
      bracketMatchId: configured.bracketMatchId,
      match,
    });
    const second = recordOfficialTournamentOutcome({
      state: first,
      circuit: "interhigh",
      level: "national",
      bracketMatchId: configured.bracketMatchId,
      match,
    });

    expect(second).toEqual(first);
  });
});

describe("player tournament result precedence", () => {
  it("maps match progress to the design precedence and never downgrades a better career result", () => {
    expect(
      tournamentResultIdForMatch({
        circuit: "interhigh",
        level: "national",
        round: "round-of-16",
        won: false,
      }),
    ).toBe("national:participant");
    expect(
      tournamentResultIdForMatch({
        circuit: "spring-high",
        level: "national",
        round: "final",
        won: true,
      }),
    ).toBe("spring-high:national:champion");
    expect(
      improveBestTournamentResultId(
        "interhigh:national:champion",
        "prefectural:champion",
      ),
    ).toBe("interhigh:national:champion");
    expect(
      improveBestTournamentResultId(
        "interhigh:national:champion",
        "spring-high:national:champion",
      ),
    ).toBe("spring-high:national:champion");
  });
});
