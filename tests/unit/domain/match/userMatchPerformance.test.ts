import { createDemoGame } from "../../../../src/app/createDemoGame";
import { buildUserMatchPerformanceSnapshot } from "../../../../src/domain/match/userMatchPerformance";
import type {
  MatchEvent,
  MatchState,
} from "../../../../src/domain/model/Match";
import { matchId } from "../../../../src/domain/model/identifiers";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";

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

describe("user match performance snapshot", () => {
  it("collects user participation and performance in one event-log pass", () => {
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
    const starterId = homeSelection.rotation[0]!.playerId;
    const receiverId = homeSelection.rotation[1]!.playerId;
    const benchId = homeSelection.benchPlayerIds[0]!;
    const awayId = awaySelection.rotation[0]!.playerId;

    const match: MatchState = {
      id: matchId("phase50-performance"),
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
          awayScore: 20,
          completed: true,
          winnerSchoolId: state.userSchoolId,
        },
        {
          setNumber: 2,
          homeScore: 25,
          awayScore: 22,
          completed: true,
          winnerSchoolId: state.userSchoolId,
        },
      ],
      servingSchoolId: state.userSchoolId,
      pendingCoachCommandForSchoolId: null,
      eventLog: [
        event({
          sequence: 1,
          type: "serve",
          actorPlayerId: starterId,
          targetPlayerId: awayId,
        }),
        event({
          sequence: 2,
          type: "attack",
          actorPlayerId: starterId,
          targetPlayerId: awayId,
          detailCode: "attack.oh",
        }),
        event({
          sequence: 3,
          type: "point",
          homeScore: 21,
          awayScore: 20,
          actorPlayerId: starterId,
          targetPlayerId: awayId,
          winnerSchoolId: state.userSchoolId,
          detailCode: "point.attack",
        }),
        event({
          sequence: 4,
          type: "receive",
          actorPlayerId: receiverId,
          targetPlayerId: awayId,
          detailCode: "receive.perfect",
        }),
        event({
          sequence: 5,
          type: "set",
          actorPlayerId: benchId,
          targetPlayerId: starterId,
          detailCode: "set.ideal",
        }),
        event({
          sequence: 6,
          type: "dig",
          actorPlayerId: benchId,
          targetPlayerId: awayId,
          detailCode: "dig.counter",
        }),
        event({
          sequence: 7,
          type: "point",
          homeScore: 22,
          awayScore: 20,
          actorPlayerId: benchId,
          targetPlayerId: awayId,
          winnerSchoolId: state.userSchoolId,
          detailCode: "point.block",
        }),
      ],
      randomSeed: state.seed,
      randomCursor: 7,
    };

    const snapshot = buildUserMatchPerformanceSnapshot(state, match);
    const starter = snapshot.players.get(starterId)!;
    const receiver = snapshot.players.get(receiverId)!;
    const bench = snapshot.players.get(benchId)!;

    expect(snapshot.userWon).toBe(true);
    expect(snapshot.completedSetCount).toBe(2);
    expect(snapshot.appearanceParticipantIds).toContain(starterId);
    expect(snapshot.appearanceParticipantIds).not.toContain(benchId);
    expect(snapshot.experienceParticipantIds).toContain(benchId);

    expect(starter.attackAttempts).toBe(1);
    expect(starter.attackPoints).toBe(1);
    expect(starter.points).toBe(1);
    expect(starter.clutchPoints).toBe(1);
    expect(starter.attackSuccessRate).toBe(100);

    expect(receiver.receiveAttempts).toBe(1);
    expect(receiver.perfectReceives).toBe(1);
    expect(receiver.perfectReceiveRate).toBe(100);

    expect(bench.idealSets).toBe(1);
    expect(bench.successfulDigs).toBe(1);
    expect(bench.blockPoints).toBe(1);
    expect(bench.points).toBe(1);
  });
});
