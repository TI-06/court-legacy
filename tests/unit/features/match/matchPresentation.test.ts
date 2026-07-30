import { createDemoGame } from "../../../../src/app/createDemoGame";
import type {
  MatchEvent,
  MatchState,
} from "../../../../src/domain/model/Match";
import { matchId, playerId } from "../../../../src/domain/model/identifiers";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import {
  presentMatchEvent,
  summarizeSetScore,
} from "../../../../src/features/match/matchPresentation";

function createContext() {
  const state = createDemoGame();
  const opponent = selectPracticeOpponent(state);
  const homeSelection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const awaySelection = autoSelectTeam({
    state,
    schoolId: opponent.id,
  });
  const match: MatchState = {
    id: matchId("presentation-match"),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponent.id,
    homeSelection,
    awaySelection,
    bestOfSets: 3,
    phase: "match-complete",
    currentSetNumber: 2,
    homeSetsWon: 2,
    awaySetsWon: 0,
    sets: [
      {
        setNumber: 1,
        homeScore: 25,
        awayScore: 18,
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
    randomSeed: state.seed,
    randomCursor: 0,
  };
  const homePlayerId = homeSelection.rotation[0]!.playerId;
  const awayPlayerId = awaySelection.rotation[0]!.playerId;

  return { state, opponent, match, homePlayerId, awayPlayerId };
}

function event(overrides: Partial<MatchEvent>): MatchEvent {
  return {
    sequence: 1,
    type: "serve",
    setNumber: 1,
    homeScore: 0,
    awayScore: 0,
    actorPlayerId: null,
    targetPlayerId: null,
    winnerSchoolId: null,
    detailCode: "serve.in-play",
    ...overrides,
  };
}

describe("match presentation", () => {
  it("presents serve and attack point events with player and score context", () => {
    const context = createContext();
    const homePlayer = context.state.players[context.homePlayerId]!;

    const serve = presentMatchEvent(
      event({
        actorPlayerId: context.homePlayerId,
        targetPlayerId: context.awayPlayerId,
      }),
      context,
    );
    const point = presentMatchEvent(
      event({
        sequence: 5,
        type: "point",
        homeScore: 1,
        actorPlayerId: context.homePlayerId,
        targetPlayerId: context.awayPlayerId,
        winnerSchoolId: context.state.userSchoolId,
        detailCode: "point.attack",
      }),
      context,
    );

    expect(serve.title).toBe("サーブ");
    expect(serve.detail).toContain(homePlayer.lastName);
    expect(point.title).toBe("アタック決定");
    expect(point.tone).toBe("home");
    expect(point.score).toBe("1 - 0");
  });

  it("presents rotation, set end, and match end as important moments", () => {
    const context = createContext();

    const rotation = presentMatchEvent(
      event({
        type: "rotation",
        actorPlayerId: context.homePlayerId,
        winnerSchoolId: context.state.userSchoolId,
        detailCode: "rotation.side-out",
      }),
      context,
    );
    const setEnd = presentMatchEvent(
      event({
        sequence: 20,
        type: "set-end",
        homeScore: 25,
        awayScore: 18,
        winnerSchoolId: context.state.userSchoolId,
        detailCode: "set.complete",
      }),
      context,
    );
    const matchEnd = presentMatchEvent(
      event({
        sequence: 40,
        type: "match-end",
        setNumber: 2,
        homeScore: 25,
        awayScore: 21,
        winnerSchoolId: context.state.userSchoolId,
        detailCode: "match.complete",
      }),
      context,
    );

    expect(rotation.title).toBe("ローテーション");
    expect(setEnd.title).toBe("第1セット終了");
    expect(setEnd.tone).toBe("important");
    expect(matchEnd.title).toBe("試合終了");
    expect(matchEnd.detail).toContain("青嵐高校");
  });

  it("falls back safely when an event references a missing player", () => {
    const context = createContext();

    const presented = presentMatchEvent(
      event({ actorPlayerId: playerId("missing-player") }),
      context,
    );

    expect(presented.detail).toContain("選手");
  });

  it("summarizes the completed set score", () => {
    const context = createContext();

    expect(summarizeSetScore(context.match)).toBe("2 - 0｜25-18 / 25-21");
  });
});
