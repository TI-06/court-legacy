import { createDemoGame } from "../../../../src/app/createDemoGame";
import type {
  MatchEvent,
  MatchState,
} from "../../../../src/domain/model/Match";
import { matchId } from "../../../../src/domain/model/identifiers";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { buildLiveMatchIntelligence } from "../../../../src/features/match/liveMatchIntelligence";

function fixture() {
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
    id: matchId("phase53-live-intelligence"),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponent.id,
    homeSelection,
    awaySelection,
    bestOfSets: 3,
    phase: "coach-decision",
    currentSetNumber: 1,
    homeSetsWon: 0,
    awaySetsWon: 0,
    sets: [],
    servingSchoolId: state.userSchoolId,
    pendingCoachCommandForSchoolId: state.userSchoolId,
    eventLog: [],
    randomSeed: state.seed,
    randomCursor: 0,
  };

  return {
    state,
    opponent,
    match,
    homeAttackerId: homeSelection.rotation[0]!.playerId,
    awayAttackerId: awaySelection.rotation[0]!.playerId,
    awayReceiverId: awaySelection.rotation[1]!.playerId,
  };
}

function event(
  sequence: number,
  overrides: Partial<MatchEvent>,
): MatchEvent {
  return {
    sequence,
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

describe("Phase53 live match intelligence", () => {
  it("never includes events beyond the visible sequence", () => {
    const base = fixture();
    base.match.eventLog = [
      event(1, {
        type: "point",
        homeScore: 1,
        actorPlayerId: base.homeAttackerId,
        winnerSchoolId: base.state.userSchoolId,
        detailCode: "point.attack",
      }),
      event(2, {
        type: "point",
        homeScore: 1,
        awayScore: 1,
        actorPlayerId: base.awayAttackerId,
        winnerSchoolId: base.opponent.id,
        detailCode: "point.attack",
      }),
      event(3, {
        type: "point",
        homeScore: 1,
        awayScore: 2,
        actorPlayerId: base.awayAttackerId,
        winnerSchoolId: base.opponent.id,
        detailCode: "point.attack",
      }),
    ];

    const intelligence = buildLiveMatchIntelligence({
      state: base.state,
      match: base.match,
      userSchoolId: base.state.userSchoolId,
      visibleEventSequence: 1,
    });

    expect(intelligence.userTeam.totalPoints).toBe(1);
    expect(intelligence.opponentTeam.totalPoints).toBe(0);
    expect(intelligence.pointFlow).toEqual({
      sampleSize: 1,
      userPoints: 1,
      opponentPoints: 0,
      trailingOpponentPoints: 0,
    });
    expect(intelligence.insights).toEqual([]);
  });

  it("builds deterministic sample-gated suggestions from observed play", () => {
    const base = fixture();
    const events: MatchEvent[] = [];
    let sequence = 1;

    for (let index = 0; index < 4; index += 1) {
      events.push(
        event(sequence++, {
          type: "attack",
          actorPlayerId: base.homeAttackerId,
          targetPlayerId: base.awayAttackerId,
          detailCode: "attack.oh",
        }),
      );
    }
    for (let index = 0; index < 3; index += 1) {
      events.push(
        event(sequence++, {
          type: "point",
          actorPlayerId: base.homeAttackerId,
          winnerSchoolId: base.state.userSchoolId,
          detailCode: "point.attack",
        }),
      );
    }

    for (let index = 0; index < 4; index += 1) {
      events.push(
        event(sequence++, {
          type: "attack",
          actorPlayerId: base.awayAttackerId,
          targetPlayerId: base.homeAttackerId,
          detailCode: "attack.oh",
        }),
      );
    }
    for (let index = 0; index < 3; index += 1) {
      events.push(
        event(sequence++, {
          type: "point",
          actorPlayerId: base.awayAttackerId,
          winnerSchoolId: base.opponent.id,
          detailCode: "point.attack",
        }),
      );
    }

    for (let index = 0; index < 3; index += 1) {
      events.push(
        event(sequence++, {
          type: "receive",
          actorPlayerId: base.awayReceiverId,
          targetPlayerId: base.homeAttackerId,
          detailCode: "receive.controlled",
        }),
      );
    }

    events.push(
      event(sequence++, {
        type: "point",
        actorPlayerId: base.homeAttackerId,
        winnerSchoolId: base.state.userSchoolId,
        detailCode: "point.defense",
      }),
    );
    base.match.eventLog = events;

    const intelligence = buildLiveMatchIntelligence({
      state: base.state,
      match: base.match,
      userSchoolId: base.state.userSchoolId,
      visibleEventSequence: events.at(-1)!.sequence,
    });

    expect(intelligence.insights.map((insight) => insight.kind)).toEqual([
      "danger-attacker",
      "receiver-under-pressure",
      "hot-attacker",
    ]);
    expect(intelligence.insights[0]).toMatchObject({
      suggestedCommand: "mark-opponent-attacker",
      targetPlayerId: base.awayAttackerId,
      sampleSize: 4,
    });
    expect(intelligence.insights[1]).toMatchObject({
      suggestedCommand: "target-serve-receiver",
      targetPlayerId: base.awayReceiverId,
      sampleSize: 3,
    });
    expect(intelligence.insights[2]).toMatchObject({
      suggestedCommand: "focus-attacker",
      targetPlayerId: base.homeAttackerId,
      sampleSize: 4,
    });
  });

  it("raises a timeout signal only after an observed opponent run reaches three points", () => {
    const base = fixture();
    base.match.eventLog = [
      event(1, {
        type: "point",
        winnerSchoolId: base.state.userSchoolId,
        detailCode: "point.attack",
      }),
      event(2, {
        type: "point",
        winnerSchoolId: base.opponent.id,
        detailCode: "point.attack",
      }),
      event(3, {
        type: "point",
        winnerSchoolId: base.opponent.id,
        detailCode: "point.block",
      }),
      event(4, {
        type: "point",
        winnerSchoolId: base.opponent.id,
        detailCode: "point.serve-ace",
      }),
    ];

    const beforeThirdLoss = buildLiveMatchIntelligence({
      state: base.state,
      match: base.match,
      userSchoolId: base.state.userSchoolId,
      visibleEventSequence: 3,
    });
    const afterThirdLoss = buildLiveMatchIntelligence({
      state: base.state,
      match: base.match,
      userSchoolId: base.state.userSchoolId,
      visibleEventSequence: 4,
    });

    expect(
      beforeThirdLoss.insights.some(
        (insight) => insight.kind === "opponent-run",
      ),
    ).toBe(false);
    expect(afterThirdLoss.insights[0]).toMatchObject({
      kind: "opponent-run",
      suggestedCommand: "timeout",
      sampleSize: 3,
    });
  });
});
