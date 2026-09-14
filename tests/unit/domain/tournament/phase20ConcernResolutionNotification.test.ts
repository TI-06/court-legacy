import { createInitialGame } from "../../../../src/app/createInitialGame";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import type { GameState } from "../../../../src/domain/model/GameState";
import type { MatchState } from "../../../../src/domain/model/Match";
import { matchId } from "../../../../src/domain/model/identifiers";
import type { TrainingResultNotification } from "../../../../src/domain/notifications/gameNotifications";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { materializeGuestOpponent } from "../../../../src/domain/tournament/materializeGuestOpponent";
import { recordOfficialTournamentOutcome } from "../../../../src/domain/tournament/recordOfficialMatch";
import type {
  GuestTournamentEntrant,
  TournamentStageState,
  WorldSchoolTournamentEntrant,
} from "../../../../src/domain/tournament/tournamentTypes";

function createState() {
  return createInitialGame({
    seed: "phase20-concern-resolution",
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
  if (!gameDataBootstrap.ok) throw new Error(gameDataBootstrap.message);
  return gameDataBootstrap.data;
}

function configureFinal(state: GameState) {
  const userSchool = state.schools[state.userSchoolId]!;
  const userEntrant: WorldSchoolTournamentEntrant = {
    entrantId: `world:${userSchool.id}`,
    source: "world-school",
    schoolId: userSchool.id,
    displayName: userSchool.name,
    shortName: userSchool.shortName,
    seedStrength: 84,
  };
  const guest: GuestTournamentEntrant = {
    entrantId: "guest:phase20:final",
    source: "guest-representative",
    displayName: "星陵学院",
    shortName: "星陵",
    regionLabel: "東海地区",
    guestSeed: "phase20-guest",
    seedStrength: 82,
  };
  const bracketMatchId = "official:interhigh:1:national:final:phase20";
  const stage: TournamentStageState = {
    tournamentId: "official:interhigh:1:national",
    circuit: "interhigh",
    level: "national",
    entrants: [userEntrant, guest],
    matches: [
      {
        id: bracketMatchId,
        round: "final",
        roundIndex: 3,
        slotIndex: 0,
        scheduledWeek: 19,
        homeEntrantId: userEntrant.entrantId,
        awayEntrantId: guest.entrantId,
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
    guest,
    bracketMatchId,
  };
}

function completedWin(
  state: GameState,
  bracketMatchId: string,
  guest: GuestTournamentEntrant,
): MatchState {
  const homeSelection = autoSelectTeam({ state, schoolId: state.userSchoolId });
  const materialized = materializeGuestOpponent({
    state,
    entrant: guest,
    data: data(),
  });

  return {
    id: matchId(bracketMatchId),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: materialized.school.id,
    homeSelection,
    awaySelection: materialized.selection,
    bestOfSets: 3,
    phase: "match-complete",
    currentSetNumber: 2,
    homeSetsWon: 2,
    awaySetsWon: 0,
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
        homeScore: 25,
        awayScore: 21,
        completed: true,
        winnerSchoolId: state.userSchoolId,
      },
    ],
    servingSchoolId: state.userSchoolId,
    pendingCoachCommandForSchoolId: null,
    eventLog: [],
    randomSeed: "phase20-concern-match",
    randomCursor: 1,
  };
}

function trainingNotification(state: GameState): TrainingResultNotification {
  return {
    id: "training-result:before-concern-resolution",
    type: "training-result",
    createdGameDate: state.date,
    academicYearIndex: state.yearIndex,
    weekOfYear: state.calendar.weekOfYear,
    readAtGameDate: null,
    payload: {
      teamTrainingMenuName: "基礎練習",
      totalAbilityGrowth: 0,
      totalFatigueChange: 0,
      injuredCount: 0,
      players: [],
    },
  };
}

describe("official match concern resolution notification", () => {
  it("appends one grouped resolution notification after authoritative dynamics clear a concern", () => {
    const configured = configureFinal(createState());
    const state = configured.state;
    const match = completedWin(
      state,
      configured.bracketMatchId,
      configured.guest,
    );
    const playerId = match.homeSelection.rotation[0]!.playerId;
    state.teamDynamics.recentOfficialMatchesTracked = 4;
    state.teamDynamics.recentOfficialStarterCounts[playerId] = 1;
    state.teamDynamics.playerConcerns[playerId] = [
      { code: "playing-time", severity: 2 },
    ];
    state.notifications.items = [trainingNotification(state)];

    const next = recordOfficialTournamentOutcome({
      state,
      circuit: "interhigh",
      level: "national",
      bracketMatchId: configured.bracketMatchId,
      match,
    });

    expect(
      next.teamDynamics.playerConcerns[playerId]?.some(
        (concern) => concern.code === "playing-time",
      ) ?? false,
    ).toBe(false);
    expect(next.notifications.items).toHaveLength(2);
    expect(next.notifications.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `concern-resolution:${match.id}`,
          type: "concern-resolution",
          payload: {
            items: [
              expect.objectContaining({
                playerId,
                concernCode: "playing-time",
                concernTitle: "出場機会への不満",
              }),
            ],
          },
        }),
        expect.objectContaining({
          id: "training-result:before-concern-resolution",
          type: "training-result",
        }),
      ]),
    );
  });

  it("does not duplicate the concern-resolution notification on an idempotent retry", () => {
    const configured = configureFinal(createState());
    const state = configured.state;
    const match = completedWin(
      state,
      configured.bracketMatchId,
      configured.guest,
    );
    const playerId = match.homeSelection.rotation[0]!.playerId;
    state.teamDynamics.recentOfficialMatchesTracked = 4;
    state.teamDynamics.recentOfficialStarterCounts[playerId] = 1;
    state.teamDynamics.playerConcerns[playerId] = [
      { code: "playing-time", severity: 2 },
    ];

    const first = recordOfficialTournamentOutcome({
      state,
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
    expect(
      second.notifications.items.filter(
        (item) => item.id === `concern-resolution:${match.id}`,
      ),
    ).toHaveLength(1);
  });
});
