import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { applyAppearancePromiseFeedback } from "../../../../src/domain/dynamics/appearancePromiseFeedback";
import type { MatchState } from "../../../../src/domain/model/Match";
import { eventId, matchId } from "../../../../src/domain/model/identifiers";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";

function createCompletedMatch() {
  const state = createDemoGame();
  const userSelection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const opponent = Object.values(state.schools).find(
    (school) => school.id !== state.userSchoolId,
  )!;
  const opponentSelection = autoSelectTeam({
    state,
    schoolId: opponent.id,
  });

  const match: MatchState = {
    id: matchId("appearance-promise-match"),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponent.id,
    homeSelection: structuredClone(userSelection),
    awaySelection: structuredClone(opponentSelection),
    bestOfSets: 3,
    phase: "match-complete",
    currentSetNumber: 2,
    homeSetsWon: 2,
    awaySetsWon: 0,
    sets: [],
    servingSchoolId: state.userSchoolId,
    pendingCoachCommandForSchoolId: null,
    eventLog: [],
    randomSeed: "appearance-promise-match",
    randomCursor: 0,
    runtime: {
      controlledSchoolId: state.userSchoolId,
      homeScore: 25,
      awayScore: 20,
      homeTactics: { serve: "balanced", attack: "balanced", block: "mixed" },
      awayTactics: { serve: "balanced", attack: "balanced", block: "mixed" },
      homeBaseSelection: structuredClone(userSelection),
      awayBaseSelection: structuredClone(opponentSelection),
      runWinnerSchoolId: null,
      runLength: 0,
      opponentRunDecisionConsumed: false,
      criticalScoreDecisionConsumed: false,
      timeoutUsedSchoolIds: [],
      timeoutBoost: null,
      pendingDecisionReason: null,
      commandHistory: [],
      ralliesInCurrentSet: 0,
    },
  };

  return { state, match, userSelection };
}

function addPromise(
  state: ReturnType<typeof createDemoGame>,
  playerId: string,
  choiceId: "starter" | "chance" | "next-match",
) {
  state.eventMemory.history.push({
    eventId: eventId("event.reserve-role-review"),
    date: state.date,
    actorPlayerIds: [playerId as never],
    choiceId,
    visibleResultCodes: [],
  });
}

describe("appearance promise feedback", () => {
  it("rewards a fulfilled starter promise and closes the active promise", () => {
    const { state, match, userSelection } = createCompletedMatch();
    const playerId = userSelection.rotation[0]!.playerId;
    const before = state.players[playerId]!;
    addPromise(state, playerId, "starter");

    const result = applyAppearancePromiseFeedback(state, match);

    expect(result.results).toContainEqual(
      expect.objectContaining({
        playerId,
        mode: "starter",
        fulfilled: true,
        trustChange: 5,
        moraleChange: 3,
      }),
    );
    expect(result.state.players[playerId]!.trust).toBe(
      Math.min(100, before.trust + 5),
    );
    expect(
      result.state.eventMemory.history.at(-1),
    ).toEqual(
      expect.objectContaining({
        eventId: eventId("event.reserve-appearance-promise-result"),
        actorPlayerIds: [playerId],
        choiceId: "fulfilled",
      }),
    );
  });

  it("recognizes an incoming substitution as a fulfilled appearance promise", () => {
    const { state, match, userSelection } = createCompletedMatch();
    const incomingPlayerId = userSelection.benchPlayerIds[0]!;
    const outgoingPlayerId = userSelection.rotation[0]!.playerId;
    addPromise(state, incomingPlayerId, "chance");

    match.homeSelection.rotation[0]!.playerId = incomingPlayerId;
    match.homeSelection.benchPlayerIds = match.homeSelection.benchPlayerIds
      .filter((playerId) => playerId !== incomingPlayerId)
      .concat(outgoingPlayerId);
    match.runtime!.commandHistory.push({
      sequence: 1,
      schoolId: state.userSchoolId,
      setNumber: 1,
      homeScore: 10,
      awayScore: 8,
      decisionReason: "mid-set",
      command: {
        type: "substitute",
        outgoingPlayerId,
        incomingPlayerId,
      },
      eventSequence: 5,
    });

    const result = applyAppearancePromiseFeedback(state, match);

    expect(result.results).toContainEqual(
      expect.objectContaining({
        playerId: incomingPlayerId,
        mode: "substitute",
        fulfilled: true,
      }),
    );
  });

  it("penalizes a broken promise when the player never appears", () => {
    const { state, match, userSelection } = createCompletedMatch();
    const playerId = userSelection.benchPlayerIds[0]!;
    const before = state.players[playerId]!;
    addPromise(state, playerId, "next-match");

    const result = applyAppearancePromiseFeedback(state, match);

    expect(result.results).toContainEqual(
      expect.objectContaining({
        playerId,
        mode: "next-match",
        fulfilled: false,
        trustChange: -8,
        moraleChange: -5,
      }),
    );
    expect(result.state.players[playerId]!.trust).toBe(
      Math.max(0, before.trust - 8),
    );
    expect(result.state.eventMemory.history.at(-1)?.choiceId).toBe("broken");
  });
});
