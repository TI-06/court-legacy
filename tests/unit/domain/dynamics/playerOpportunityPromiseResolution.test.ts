import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  deriveActivePlayerOpportunityPromises,
  derivePlayerOpportunityRequests,
} from "../../../../src/domain/dynamics/playerOpportunityRequests";
import {
  latestPlayerOpportunityPromiseOutcomes,
  resolvePlayerOpportunityPromisesAfterOfficialMatch,
} from "../../../../src/domain/dynamics/playerOpportunityPromiseResolution";
import {
  eventId,
  matchId,
  type PlayerId,
} from "../../../../src/domain/model/identifiers";
import type { MatchState } from "../../../../src/domain/model/Match";
import type { TeamSelection } from "../../../../src/domain/model/TeamSelection";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import {
  prioritizePlayerForPreMatch,
  replacePreMatchPlayer,
} from "../../../../src/domain/match/preMatchLineup";

function addPromise(
  state: ReturnType<typeof createDemoGame>,
  playerId: PlayerId,
  choiceId: "start-next" | "sub-next" | "appearance-next" | "chance",
) {
  state.eventMemory.history.push({
    eventId: eventId("event.reserve-role-review"),
    date: state.date,
    actorPlayerIds: [playerId],
    choiceId,
    visibleResultCodes: [],
  });
}

function completedMatch(
  state: ReturnType<typeof createDemoGame>,
  selection: TeamSelection,
  eventLog: MatchState["eventLog"] = [],
): MatchState {
  const opponent = Object.values(state.schools).find(
    (school) => school.id !== state.userSchoolId,
  );
  if (!opponent) throw new Error("opponent fixture missing");
  const opponentSelection = autoSelectTeam({
    state,
    schoolId: opponent.id,
  });

  return {
    id: matchId("promise-resolution-test"),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponent.id,
    homeSelection: structuredClone(selection),
    awaySelection: opponentSelection,
    bestOfSets: 3,
    phase: "match-complete",
    currentSetNumber: 3,
    homeSetsWon: 2,
    awaySetsWon: 0,
    sets: [],
    servingSchoolId: state.userSchoolId,
    pendingCoachCommandForSchoolId: null,
    eventLog,
    randomSeed: "promise-resolution",
    randomCursor: 0,
  };
}

describe("player opportunity promises", () => {
  it("surfaces starter, substitute, and generic appearance promises distinctly", () => {
    const state = createDemoGame();
    const ids = state.schools[state.userSchoolId]!.playerIds.slice(0, 3);
    addPromise(state, ids[0]!, "start-next");
    addPromise(state, ids[1]!, "sub-next");
    addPromise(state, ids[2]!, "appearance-next");

    expect(deriveActivePlayerOpportunityPromises(state)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: ids[0],
          promiseKind: "starter",
        }),
        expect.objectContaining({
          playerId: ids[1],
          promiseKind: "substitute",
        }),
        expect.objectContaining({
          playerId: ids[2],
          promiseKind: "appearance",
        }),
      ]),
    );

    expect(derivePlayerOpportunityRequests(state)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: ids[0],
          title: "先発起用を約束中",
          promiseKind: "starter",
        }),
        expect.objectContaining({
          playerId: ids[1],
          title: "途中出場を約束中",
          promiseKind: "substitute",
        }),
        expect.objectContaining({
          playerId: ids[2],
          title: "次戦起用を約束中",
          promiseKind: "appearance",
        }),
      ]),
    );
  });

  it("rewards a starter promise when the player starts the next official match", () => {
    const state = createDemoGame();
    const base = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const promisedId = base.benchPlayerIds.find(
      (playerId) => !state.players[playerId]?.injury,
    );
    expect(promisedId).toBeDefined();
    addPromise(state, promisedId!, "start-next");

    const selection = prioritizePlayerForPreMatch({
      state,
      schoolId: state.userSchoolId,
      selection: base,
      playerId: promisedId!,
    });
    const before = state.players[promisedId!]!;
    const resolution = resolvePlayerOpportunityPromisesAfterOfficialMatch(
      state,
      completedMatch(state, selection),
    );
    const after = resolution.state.players[promisedId!]!;

    expect(resolution.outcomes).toContainEqual(
      expect.objectContaining({
        playerId: promisedId,
        promiseKind: "starter",
        status: "kept",
        trustChange: 6,
        moraleChange: 5,
      }),
    );
    expect(after.trust).toBe(Math.min(100, before.trust + 6));
    expect(after.morale).toBe(Math.min(100, before.morale + 5));
    expect(
      deriveActivePlayerOpportunityPromises(resolution.state),
    ).toHaveLength(0);
    expect(latestPlayerOpportunityPromiseOutcomes(resolution.state)[0]).toEqual(
      expect.objectContaining({
        playerId: promisedId,
        status: "kept",
        promiseKind: "starter",
      }),
    );
  });

  it("rewards a substitute promise when the player enters during the match", () => {
    const state = createDemoGame();
    const base = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const promisedId = base.benchPlayerIds[0]!;
    const outgoingId = base.rotation[0]!.playerId;
    addPromise(state, promisedId, "sub-next");

    const finalSelection = replacePreMatchPlayer({
      selection: base,
      outgoingPlayerId: outgoingId,
      incomingPlayerId: promisedId,
    });
    const match = completedMatch(state, finalSelection, [
      {
        sequence: 1,
        type: "substitution",
        setNumber: 2,
        homeScore: 10,
        awayScore: 8,
        actorPlayerId: promisedId,
        targetPlayerId: outgoingId,
        winnerSchoolId: state.userSchoolId,
        detailCode: "substitution.coach-command",
      },
    ]);

    const resolution = resolvePlayerOpportunityPromisesAfterOfficialMatch(
      state,
      match,
    );

    expect(resolution.outcomes).toContainEqual(
      expect.objectContaining({
        playerId: promisedId,
        promiseKind: "substitute",
        status: "kept",
      }),
    );
  });

  it("penalizes a broken promise and clears it after the next official match", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const promisedId = selection.benchPlayerIds[0]!;
    addPromise(state, promisedId, "appearance-next");
    const before = state.players[promisedId]!;

    const resolution = resolvePlayerOpportunityPromisesAfterOfficialMatch(
      state,
      completedMatch(state, selection),
    );
    const after = resolution.state.players[promisedId]!;

    expect(resolution.outcomes).toContainEqual(
      expect.objectContaining({
        playerId: promisedId,
        status: "broken",
        trustChange: -7,
        moraleChange: -5,
      }),
    );
    expect(after.trust).toBe(Math.max(0, before.trust - 7));
    expect(after.morale).toBe(Math.max(0, before.morale - 5));
    expect(
      deriveActivePlayerOpportunityPromises(resolution.state),
    ).toHaveLength(0);
  });

  it("excuses an unfulfilled promise when the player is injured", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const promisedId = selection.benchPlayerIds[0]!;
    addPromise(state, promisedId, "appearance-next");
    state.players[promisedId] = {
      ...state.players[promisedId]!,
      injury: {
        injuryId: "promise-test-injury",
        severity: "minor",
        remainingWeeks: 1,
        recurrenceRisk: 10,
      },
    };
    const before = state.players[promisedId]!;

    const resolution = resolvePlayerOpportunityPromisesAfterOfficialMatch(
      state,
      completedMatch(state, selection),
    );
    const after = resolution.state.players[promisedId]!;

    expect(resolution.outcomes).toContainEqual(
      expect.objectContaining({
        playerId: promisedId,
        status: "excused",
        trustChange: 0,
        moraleChange: 0,
      }),
    );
    expect(after.trust).toBe(before.trust);
    expect(after.morale).toBe(before.morale);
  });
});
