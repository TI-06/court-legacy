import { createDemoGame } from "../../../../src/app/createDemoGame";
import type {
  GameState,
  HistoricalMatchSummary,
} from "../../../../src/domain/model/GameState";
import {
  matchId,
  type GameDate,
  type SchoolId,
} from "../../../../src/domain/model/identifiers";
import {
  selectNotableUserMatches,
  selectUserHeadToHead,
  selectUserHeadToHeadTable,
} from "../../../../src/domain/world/rivalryHistory";
import { rivalryKey } from "../../../../src/domain/world/rivalWorldProgression";

function opponents(state: GameState): SchoolId[] {
  return Object.values(state.schools)
    .filter((school) => school.id !== state.userSchoolId)
    .slice(0, 3)
    .map((school) => school.id);
}

function addMatch(
  state: GameState,
  input: {
    id: string;
    date: GameDate;
    opponentSchoolId: SchoolId;
    userHome?: boolean;
    userWon: boolean;
    userSetsWon?: number;
    opponentSetsWon?: number;
    official?: boolean;
  },
): void {
  const userHome = input.userHome ?? true;
  const userSetsWon = input.userSetsWon ?? (input.userWon ? 2 : 1);
  const opponentSetsWon =
    input.opponentSetsWon ?? (input.userWon ? 1 : 2);
  const summary: HistoricalMatchSummary = {
    matchId: matchId(input.id),
    date: input.date,
    homeSchoolId: userHome ? state.userSchoolId : input.opponentSchoolId,
    awaySchoolId: userHome ? input.opponentSchoolId : state.userSchoolId,
    winnerSchoolId: input.userWon
      ? state.userSchoolId
      : input.opponentSchoolId,
    homeSetsWon: userHome ? userSetsWon : opponentSetsWon,
    awaySetsWon: userHome ? opponentSetsWon : userSetsWon,
    tournamentId: input.official ? `official:${input.id}` : null,
  };
  state.history.matches.push(summary);
}

describe("Phase20 rivalry history", () => {
  it("derives lifetime records from the user perspective across home and away matches", () => {
    const state = createDemoGame();
    const [rival] = opponents(state);
    expect(rival).toBeDefined();

    addMatch(state, {
      id: "h2h-1",
      date: "2026-04-01",
      opponentSchoolId: rival!,
      userWon: true,
      official: true,
    });
    addMatch(state, {
      id: "h2h-2",
      date: "2026-05-01",
      opponentSchoolId: rival!,
      userHome: false,
      userWon: false,
    });
    addMatch(state, {
      id: "h2h-3",
      date: "2026-06-01",
      opponentSchoolId: rival!,
      userWon: true,
      official: true,
    });
    addMatch(state, {
      id: "h2h-4",
      date: "2026-07-01",
      opponentSchoolId: rival!,
      userHome: false,
      userWon: false,
      official: true,
    });
    addMatch(state, {
      id: "h2h-5",
      date: "2026-08-01",
      opponentSchoolId: rival!,
      userWon: false,
    });

    const summary = selectUserHeadToHead(state, rival!);

    expect(summary).toMatchObject({
      totalMeetings: 5,
      wins: 2,
      losses: 3,
      officialMeetings: 3,
      practiceMeetings: 2,
      currentStreak: { result: "loss", count: 2 },
    });
    expect(summary.lastFive).toHaveLength(5);
    expect(summary.lastFive[0]?.matchId).toBe(matchId("h2h-5"));
    expect(summary.lastMeeting).toMatchObject({
      result: "loss",
      userSetsWon: 1,
      opponentSetsWon: 2,
    });
  });

  it("classifies destiny, rivalry, nemesis, revenge, and visible streak labels at their boundaries", () => {
    const state = createDemoGame();
    const [destinyId, rivalryId] = opponents(state);
    expect(destinyId).toBeDefined();
    expect(rivalryId).toBeDefined();

    for (let index = 0; index < 4; index += 1) {
      addMatch(state, {
        id: `destiny-${index}`,
        date: `2026-0${index + 4}-01` as GameDate,
        opponentSchoolId: destinyId!,
        userWon: index === 0,
      });
    }
    state.world.destinyRivalSchoolId = destinyId;
    state.world.rivalryScores[rivalryKey(state.userSchoolId, destinyId!)] = 80;

    addMatch(state, {
      id: "rivalry-39",
      date: "2026-04-02",
      opponentSchoolId: rivalryId!,
      userWon: true,
    });
    state.world.rivalryScores[rivalryKey(state.userSchoolId, rivalryId!)] = 39;

    const beforeThreshold = selectUserHeadToHead(state, rivalryId!);
    expect(beforeThreshold.labels).not.toContain("rivalry");

    state.world.rivalryScores[rivalryKey(state.userSchoolId, rivalryId!)] = 40;
    const atThreshold = selectUserHeadToHead(state, rivalryId!);
    const destiny = selectUserHeadToHead(state, destinyId!);

    expect(atThreshold.labels).toContain("rivalry");
    expect(destiny.labels).toContain("destiny-rival");
    expect(destiny.labels).not.toContain("rivalry");
    expect(destiny.labels).toContain("nemesis");
    expect(destiny.labels).toContain("revenge");
    expect(destiny.labels).toContain("losing-streak");
  });

  it("does not call a three-meeting opponent a nemesis", () => {
    const state = createDemoGame();
    const [rival] = opponents(state);
    expect(rival).toBeDefined();

    for (let index = 0; index < 3; index += 1) {
      addMatch(state, {
        id: `three-losses-${index}`,
        date: `2026-0${index + 4}-03` as GameDate,
        opponentSchoolId: rival!,
        userWon: false,
      });
    }

    expect(selectUserHeadToHead(state, rival!).labels).not.toContain("nemesis");
  });

  it("sorts the head-to-head table by destiny status, rivalry score, meetings, then id", () => {
    const state = createDemoGame();
    const [first, second, third] = opponents(state);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(third).toBeDefined();

    addMatch(state, {
      id: "table-first",
      date: "2026-04-01",
      opponentSchoolId: first!,
      userWon: true,
    });
    addMatch(state, {
      id: "table-second-1",
      date: "2026-04-02",
      opponentSchoolId: second!,
      userWon: true,
    });
    addMatch(state, {
      id: "table-second-2",
      date: "2026-05-02",
      opponentSchoolId: second!,
      userWon: false,
    });
    addMatch(state, {
      id: "table-third",
      date: "2026-04-03",
      opponentSchoolId: third!,
      userWon: false,
    });

    state.world.destinyRivalSchoolId = first;
    state.world.rivalryScores[rivalryKey(state.userSchoolId, first!)] = 20;
    state.world.rivalryScores[rivalryKey(state.userSchoolId, second!)] = 70;
    state.world.rivalryScores[rivalryKey(state.userSchoolId, third!)] = 50;

    const table = selectUserHeadToHeadTable(state);
    expect(table.map((entry) => entry.opponentSchoolId)).toEqual([
      first,
      second,
      third,
    ]);
  });

  it("ranks notable matches only from persisted match facts and rivalry context", () => {
    const state = createDemoGame();
    const [rival, other] = opponents(state);
    expect(rival).toBeDefined();
    expect(other).toBeDefined();

    addMatch(state, {
      id: "plain",
      date: "2026-04-01",
      opponentSchoolId: other!,
      userWon: true,
      userSetsWon: 2,
      opponentSetsWon: 0,
    });
    addMatch(state, {
      id: "rival-close-official",
      date: "2026-05-01",
      opponentSchoolId: rival!,
      userWon: false,
      userSetsWon: 1,
      opponentSetsWon: 2,
      official: true,
    });
    state.world.rivalryScores[rivalryKey(state.userSchoolId, rival!)] = 45;

    const before = selectNotableUserMatches(state, 5).map((entry) => ({
      id: entry.match.matchId,
      reasons: entry.reasons,
    }));

    const rivalSchool = state.schools[rival!]!;
    state.schools[rival!] = {
      ...rivalSchool,
      reputationPoints: rivalSchool.reputationPoints + 500,
    };
    for (const playerId of rivalSchool.playerIds) {
      const player = state.players[playerId]!;
      state.players[playerId] = {
        ...player,
        abilities: Object.fromEntries(
          Object.keys(player.abilities).map((key) => [key, 100]),
        ) as typeof player.abilities,
      };
    }

    const after = selectNotableUserMatches(state, 5).map((entry) => ({
      id: entry.match.matchId,
      reasons: entry.reasons,
    }));

    expect(after).toEqual(before);
    expect(after[0]).toMatchObject({
      id: matchId("rival-close-official"),
      reasons: expect.arrayContaining(["official", "close", "rival"]),
    });
  });
});
