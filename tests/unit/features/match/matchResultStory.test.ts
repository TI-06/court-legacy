import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type {
  GameState,
  HistoricalMatchSummary,
} from "../../../../src/domain/model/GameState";
import type { MatchState } from "../../../../src/domain/model/Match";
import {
  matchId,
  type GameDate,
  type SchoolId,
} from "../../../../src/domain/model/identifiers";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { buildMatchResultStory } from "../../../../src/features/match/matchResultStory";

function opponentId(state: GameState): SchoolId {
  const opponent = Object.values(state.schools).find(
    (school) => school.id !== state.userSchoolId,
  );
  if (!opponent) throw new Error("opponent fixture missing");
  return opponent.id;
}

function completedMatch(
  state: GameState,
  opponentSchoolId: SchoolId,
  id = "phase26-5-current",
): MatchState {
  return {
    id: matchId(id),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponentSchoolId,
    homeSelection: autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    }),
    awaySelection: autoSelectTeam({
      state,
      schoolId: opponentSchoolId,
    }),
    bestOfSets: 3,
    phase: "match-complete",
    currentSetNumber: 3,
    homeSetsWon: 2,
    awaySetsWon: 1,
    sets: [
      {
        setNumber: 1,
        homeScore: 25,
        awayScore: 21,
        completed: true,
        winnerSchoolId: state.userSchoolId,
      },
      {
        setNumber: 2,
        homeScore: 22,
        awayScore: 25,
        completed: true,
        winnerSchoolId: opponentSchoolId,
      },
      {
        setNumber: 3,
        homeScore: 25,
        awayScore: 20,
        completed: true,
        winnerSchoolId: state.userSchoolId,
      },
    ],
    servingSchoolId: state.userSchoolId,
    pendingCoachCommandForSchoolId: null,
    eventLog: [],
    randomSeed: "phase26-5",
    randomCursor: 0,
  };
}

function addHistoricalMatch(
  state: GameState,
  input: {
    id: string;
    date: GameDate;
    opponentSchoolId: SchoolId;
    userWon: boolean;
    userSetsWon?: number;
    opponentSetsWon?: number;
  },
): void {
  const userSetsWon = input.userSetsWon ?? (input.userWon ? 2 : 1);
  const opponentSetsWon = input.opponentSetsWon ?? (input.userWon ? 1 : 2);
  const summary: HistoricalMatchSummary = {
    matchId: matchId(input.id),
    date: input.date,
    homeSchoolId: state.userSchoolId,
    awaySchoolId: input.opponentSchoolId,
    winnerSchoolId: input.userWon ? state.userSchoolId : input.opponentSchoolId,
    homeSetsWon: userSetsWon,
    awaySetsWon: opponentSetsWon,
    tournamentId: null,
  };
  state.history.matches.push(summary);
}

describe("matchResultStory", () => {
  it("restores the pre-match record and avoids double-counting the current saved match", () => {
    const state = createDemoGame();
    const opponent = opponentId(state);
    const match = completedMatch(state, opponent);

    addHistoricalMatch(state, {
      id: "prior-loss",
      date: "2026-04-01",
      opponentSchoolId: opponent,
      userWon: false,
    });
    state.history.matches.push({
      matchId: match.id,
      date: state.date,
      homeSchoolId: match.homeSchoolId,
      awaySchoolId: match.awaySchoolId,
      winnerSchoolId: state.userSchoolId,
      homeSetsWon: 2,
      awaySetsWon: 1,
      tournamentId: null,
    });

    const story = buildMatchResultStory(state, match);

    expect(story).not.toBeNull();
    expect(story?.headline).toContain("雪辱達成");
    expect(story?.recordLabel).toBe("通算 1勝1敗");
    expect(story?.chips).toEqual(
      expect.arrayContaining(["雪辱達成", "フルセット"]),
    );
  });

  it("calls out a win over a prior nemesis", () => {
    const state = createDemoGame();
    const opponent = opponentId(state);
    const match = completedMatch(state, opponent);

    for (let index = 0; index < 4; index += 1) {
      addHistoricalMatch(state, {
        id: `nemesis-${index}`,
        date: `2026-0${index + 4}-02` as GameDate,
        opponentSchoolId: opponent,
        userWon: false,
      });
    }

    const story = buildMatchResultStory(state, match);

    expect(story?.headline).toContain("天敵");
    expect(story?.chips).toContain("天敵撃破");
    expect(story?.recordLabel).toBe("通算 1勝4敗");
  });

  it("gives destiny-rival identity headline precedence", () => {
    const state = createDemoGame();
    const opponent = opponentId(state);
    const match = completedMatch(state, opponent);
    state.world.destinyRivalSchoolId = opponent;

    const story = buildMatchResultStory(state, match);

    expect(story?.headline).toContain("宿敵");
    expect(story?.chips).toEqual(
      expect.arrayContaining(["宿敵", "初対戦", "フルセット"]),
    );
  });

  it("does not invent local rivalry context for an opponent missing from the world", () => {
    const state = createDemoGame();
    const localOpponent = opponentId(state);
    const match = completedMatch(state, localOpponent);
    const unknownSchoolId = "pvp-external-school" as SchoolId;
    match.awaySchoolId = unknownSchoolId;

    expect(buildMatchResultStory(state, match)).toBeNull();
  });
});
