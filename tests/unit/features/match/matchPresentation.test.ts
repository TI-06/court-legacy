import { createDemoGame } from "../../../../src/app/createDemoGame";
import type {
  MatchEvent,
  MatchState,
} from "../../../../src/domain/model/Match";
import { matchId, playerId } from "../../../../src/domain/model/identifiers";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import {
  buildMatchStatSummary,
  buildTeamProfile,
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
  const secondHomePlayerId = homeSelection.rotation[1]!.playerId;
  const awayPlayerId = awaySelection.rotation[0]!.playerId;

  return {
    state,
    opponent,
    match,
    homeSelection,
    awaySelection,
    homePlayerId,
    secondHomePlayerId,
    awayPlayerId,
  };
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
    const homeSchool = context.state.schools[context.state.userSchoolId]!;

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
    expect(matchEnd.detail).toContain(homeSchool.name);
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

  it("builds six volleyball team profile ratings from the selected lineup", () => {
    const context = createContext();

    const profile = buildTeamProfile(context.state, context.homeSelection);

    expect(Object.keys(profile)).toEqual([
      "attack",
      "block",
      "serve",
      "receive",
      "teamwork",
      "stamina",
    ]);
    for (const rating of Object.values(profile)) {
      expect(rating).toBeGreaterThanOrEqual(0);
      expect(rating).toBeLessThanOrEqual(100);
      expect(Number.isInteger(rating)).toBe(true);
    }
  });

  it("derives player awards and volleyball box score from immutable match events", () => {
    const context = createContext();
    const homeSchoolId = context.match.homeSchoolId;
    context.match.eventLog = [
      event({
        sequence: 1,
        type: "attack",
        actorPlayerId: context.homePlayerId,
        targetPlayerId: context.awayPlayerId,
        detailCode: "attack.oh",
      }),
      event({
        sequence: 2,
        type: "point",
        homeScore: 1,
        actorPlayerId: context.homePlayerId,
        targetPlayerId: context.awayPlayerId,
        winnerSchoolId: homeSchoolId,
        detailCode: "point.attack",
      }),
      event({
        sequence: 3,
        type: "attack",
        actorPlayerId: context.homePlayerId,
        targetPlayerId: context.awayPlayerId,
        detailCode: "attack.oh",
      }),
      event({
        sequence: 4,
        type: "point",
        homeScore: 2,
        actorPlayerId: context.homePlayerId,
        targetPlayerId: context.awayPlayerId,
        winnerSchoolId: homeSchoolId,
        detailCode: "point.serve-ace",
      }),
      event({
        sequence: 5,
        type: "point",
        homeScore: 3,
        actorPlayerId: context.secondHomePlayerId,
        targetPlayerId: context.awayPlayerId,
        winnerSchoolId: homeSchoolId,
        detailCode: "point.block",
      }),
      event({
        sequence: 6,
        type: "receive",
        actorPlayerId: context.secondHomePlayerId,
        targetPlayerId: context.awayPlayerId,
        detailCode: "receive.perfect",
      }),
      event({
        sequence: 7,
        type: "receive",
        actorPlayerId: context.secondHomePlayerId,
        targetPlayerId: context.awayPlayerId,
        detailCode: "receive.controlled",
      }),
    ];

    const summary = buildMatchStatSummary(context.state, context.match);

    expect(summary.home.attackPoints).toBe(1);
    expect(summary.home.blockPoints).toBe(1);
    expect(summary.home.serviceAces).toBe(1);
    expect(summary.home.attackAttempts).toBe(2);
    expect(summary.home.attackSuccessRate).toBe(50);
    expect(summary.home.perfectReceiveRate).toBe(50);
    expect(summary.mvp.playerId).toBe(context.homePlayerId);
    expect(summary.topScorer.playerId).toBe(context.homePlayerId);
    expect(summary.topBlocker.playerId).toBe(context.secondHomePlayerId);
    expect(summary.topServer.playerId).toBe(context.homePlayerId);
    expect(summary.bestReceiver.playerId).toBe(context.secondHomePlayerId);
  });
});
