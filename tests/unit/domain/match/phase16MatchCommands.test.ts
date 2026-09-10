import { describe, expect, it } from "vitest";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import {
  applyMatchCommand,
  MatchCommandValidationError,
} from "../../../../src/domain/match/applyMatchCommand";
import { startMatch } from "../../../../src/domain/match/simulateMatch";
import type { MatchState } from "../../../../src/domain/model/Match";
import { createAbilities } from "../../../../src/domain/model/Player";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;
const userSchool = {
  name: "蒼波高校",
  shortName: "蒼波",
  regionId: "region.test",
  coachName: "高城 監督",
  uniform: {
    primary: "#173B52",
    secondary: "#F4F7F8",
    accent: "#D89A2B",
  },
};

function createContext(seed = "phase16-command-world") {
  const state = generateWorld({ seed, userSchool, data });
  const homeSchoolId = state.userSchoolId;
  const awaySchoolId = Object.values(state.schools).find(
    (school) => school.id !== homeSchoolId,
  )!.id;
  const homeSelection = autoSelectTeam({ state, schoolId: homeSchoolId });
  const awaySelection = autoSelectTeam({ state, schoolId: awaySchoolId });
  return {
    state,
    homeSchoolId,
    awaySchoolId,
    homeSelection,
    awaySelection,
  };
}

function startInteractive(
  context: ReturnType<typeof createContext>,
  randomSeed: string,
) {
  return startMatch({
    state: context.state,
    id: matchId(`phase16-command-${randomSeed}`),
    homeSchoolId: context.homeSchoolId,
    awaySchoolId: context.awaySchoolId,
    homeSelection: context.homeSelection,
    awaySelection: context.awaySelection,
    bestOfSets: 3,
    random: new SeededRandom(randomSeed),
    controlledSchoolId: context.homeSchoolId,
  }).match;
}

function findOpponentRunDecision(context: ReturnType<typeof createContext>) {
  for (let index = 0; index < 240; index += 1) {
    const match = startInteractive(context, `run-${index}`);
    if (match.runtime?.pendingDecisionReason === "opponent-run") {
      return match;
    }
  }
  throw new Error("test fixture could not find an opponent-run decision");
}

function findSetBreakDecision(context: ReturnType<typeof createContext>) {
  for (let index = 0; index < 240; index += 1) {
    const match = startInteractive(context, `break-${index}`);
    if (match.runtime?.pendingDecisionReason === "set-break") {
      return match;
    }
  }
  throw new Error("test fixture could not find a set-break decision");
}

function makeHomeDominant(context: ReturnType<typeof createContext>) {
  for (const playerId of context.state.schools[context.homeSchoolId]!.playerIds) {
    context.state.players[playerId] = {
      ...context.state.players[playerId]!,
      abilities: createAbilities(98),
      condition: 100,
      fatigue: 0,
      injury: null,
      positionAptitudes: { OH: 98, MB: 98, OP: 98, S: 98, L: 98 },
    };
  }
  for (const playerId of context.state.schools[context.awaySchoolId]!.playerIds) {
    context.state.players[playerId] = {
      ...context.state.players[playerId]!,
      abilities: createAbilities(18),
      condition: 50,
      fatigue: 50,
      injury: null,
      positionAptitudes: { OH: 18, MB: 18, OP: 18, S: 18, L: 18 },
    };
  }
  context.homeSelection = autoSelectTeam({
    state: context.state,
    schoolId: context.homeSchoolId,
  });
  context.awaySelection = autoSelectTeam({
    state: context.state,
    schoolId: context.awaySchoolId,
  });
  return context;
}

function expectValidationCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(MatchCommandValidationError);
    expect((error as MatchCommandValidationError).code).toBe(code);
    return;
  }
  throw new Error(`expected MatchCommandValidationError: ${code}`);
}

describe("Phase16 match commands", () => {
  it("rejects commands outside a coach-decision without mutating the match", () => {
    const context = createContext("invalid-phase-world");
    const pending = findOpponentRunDecision(context);
    const match: MatchState = {
      ...structuredClone(pending),
      phase: "set-in-progress",
      pendingCoachCommandForSchoolId: null,
    };
    if (match.runtime) match.runtime.pendingDecisionReason = null;
    const before = structuredClone(match);

    expectValidationCode(
      () =>
        applyMatchCommand({
          state: context.state,
          match,
          schoolId: context.homeSchoolId,
          command: { type: "continue" },
        }),
      "match_not_waiting_for_command",
    );
    expect(match).toEqual(before);
  });

  it("rejects a command from the wrong school without consuming the cursor", () => {
    const context = createContext("wrong-school-world");
    const match = findOpponentRunDecision(context);
    const before = structuredClone(match);

    expectValidationCode(
      () =>
        applyMatchCommand({
          state: context.state,
          match,
          schoolId: context.awaySchoolId,
          command: { type: "continue" },
        }),
      "command_school_not_pending",
    );
    expect(match).toEqual(before);
    expect(match.randomCursor).toBe(before.randomCursor);
  });

  it("allows one timeout only at an opponent-run decision", () => {
    const context = createContext("timeout-world");
    const match = findOpponentRunDecision(context);
    const cursor = match.randomCursor;
    const beforeEvents = match.eventLog.length;

    const next = applyMatchCommand({
      state: context.state,
      match,
      schoolId: context.homeSchoolId,
      command: { type: "timeout" },
    });

    expect(next.randomCursor).toBe(cursor);
    expect(next.phase).toBe("set-in-progress");
    expect(next.pendingCoachCommandForSchoolId).toBeNull();
    expect(next.runtime?.pendingDecisionReason).toBeNull();
    expect(next.runtime?.opponentRunDecisionConsumed).toBe(true);
    expect(next.runtime?.timeoutBoost).toEqual({
      schoolId: context.homeSchoolId,
      ralliesRemaining: 5,
    });
    expect(next.runtime?.timeoutUsedSchoolIds).toContain(context.homeSchoolId);
    expect(next.eventLog).toHaveLength(beforeEvents + 1);
    expect(next.eventLog.at(-1)).toMatchObject({
      type: "timeout",
      winnerSchoolId: context.homeSchoolId,
      detailCode: "timeout.coach-command",
    });
    expect(next.runtime?.commandHistory.at(-1)?.command).toEqual({
      type: "timeout",
    });

    const duplicate = structuredClone(next);
    duplicate.phase = "coach-decision";
    duplicate.pendingCoachCommandForSchoolId = context.homeSchoolId;
    duplicate.runtime!.pendingDecisionReason = "opponent-run";
    const duplicateBefore = structuredClone(duplicate);
    expectValidationCode(
      () =>
        applyMatchCommand({
          state: context.state,
          match: duplicate,
          schoolId: context.homeSchoolId,
          command: { type: "timeout" },
        }),
      "timeout_already_used",
    );
    expect(duplicate).toEqual(duplicateBefore);
  });

  it("rejects timeout during a set break", () => {
    const context = makeHomeDominant(createContext("timeout-break-world"));
    const match = findSetBreakDecision(context);
    const before = structuredClone(match);

    expectValidationCode(
      () =>
        applyMatchCommand({
          state: context.state,
          match,
          schoolId: context.homeSchoolId,
          command: { type: "timeout" },
        }),
      "command_not_allowed_for_decision",
    );
    expect(match).toEqual(before);
  });

  it("changes only the match-local tactics for the commanding school", () => {
    const context = createContext("tactics-world");
    const match = findOpponentRunDecision(context);
    const persistentTactics = structuredClone(
      context.state.schools[context.homeSchoolId]!.tactics,
    );
    const awayPlan = structuredClone(match.runtime!.awayTactics);
    const plan = { serve: "aggressive", attack: "quick", block: "commit" } as const;

    const next = applyMatchCommand({
      state: context.state,
      match,
      schoolId: context.homeSchoolId,
      command: { type: "set-match-tactics", plan },
    });

    expect(next.runtime?.homeTactics).toEqual(plan);
    expect(next.runtime?.awayTactics).toEqual(awayPlan);
    expect(context.state.schools[context.homeSchoolId]!.tactics).toEqual(
      persistentTactics,
    );
    expect(next.runtime?.commandHistory.at(-1)?.command).toEqual({
      type: "set-match-tactics",
      plan,
    });
  });

  it("substitutes one court player with one bench player only inside the match", () => {
    const context = createContext("substitution-world");
    const match = findOpponentRunDecision(context);
    const persistentSelection = structuredClone(context.homeSelection);
    const outgoingPlayerId = match.homeSelection.rotation[0]!.playerId;
    const incomingPlayerId = match.homeSelection.benchPlayerIds[0]!;

    const next = applyMatchCommand({
      state: context.state,
      match,
      schoolId: context.homeSchoolId,
      command: { type: "substitute", outgoingPlayerId, incomingPlayerId },
    });

    expect(
      next.homeSelection.rotation.some(
        (assignment) => assignment.playerId === incomingPlayerId,
      ),
    ).toBe(true);
    expect(
      next.homeSelection.rotation.some(
        (assignment) => assignment.playerId === outgoingPlayerId,
      ),
    ).toBe(false);
    expect(next.homeSelection.benchPlayerIds).toContain(outgoingPlayerId);
    expect(next.homeSelection.benchPlayerIds).not.toContain(incomingPlayerId);
    expect(next.runtime?.homeBaseSelection.rotation).toEqual(
      next.homeSelection.rotation,
    );
    expect(context.homeSelection).toEqual(persistentSelection);
    expect(next.eventLog.at(-1)).toMatchObject({
      type: "substitution",
      actorPlayerId: incomingPlayerId,
      targetPlayerId: outgoingPlayerId,
      winnerSchoolId: context.homeSchoolId,
      detailCode: "substitution.coach-command",
    });
  });

  it("rejects invalid substitution membership without mutating the match", () => {
    const context = createContext("invalid-sub-world");
    const match = findOpponentRunDecision(context);
    const before = structuredClone(match);
    const nonCourtPlayerId = match.homeSelection.benchPlayerIds[0]!;
    const incomingPlayerId = match.homeSelection.benchPlayerIds[1]!;

    expectValidationCode(
      () =>
        applyMatchCommand({
          state: context.state,
          match,
          schoolId: context.homeSchoolId,
          command: {
            type: "substitute",
            outgoingPlayerId: nonCourtPlayerId,
            incomingPlayerId,
          },
        }),
      "substitution_outgoing_not_on_court",
    );
    expect(match).toEqual(before);
  });

  it("continue consumes the decision without changing lineup or tactics", () => {
    const context = createContext("continue-world");
    const match = findOpponentRunDecision(context);
    const homeSelection = structuredClone(match.homeSelection);
    const tactics = structuredClone(match.runtime!.homeTactics);
    const cursor = match.randomCursor;

    const next = applyMatchCommand({
      state: context.state,
      match,
      schoolId: context.homeSchoolId,
      command: { type: "continue" },
    });

    expect(next.phase).toBe("set-in-progress");
    expect(next.homeSelection).toEqual(homeSelection);
    expect(next.runtime?.homeTactics).toEqual(tactics);
    expect(next.randomCursor).toBe(cursor);
    expect(next.runtime?.opponentRunDecisionConsumed).toBe(true);
    expect(next.runtime?.commandHistory.at(-1)?.command).toEqual({
      type: "continue",
    });
  });

  it("set-break commands resume through set-complete instead of starting a hidden rally", () => {
    const context = makeHomeDominant(createContext("set-break-continue-world"));
    const match = findSetBreakDecision(context);
    const eventCount = match.eventLog.length;

    const next = applyMatchCommand({
      state: context.state,
      match,
      schoolId: context.homeSchoolId,
      command: { type: "continue" },
    });

    expect(next.phase).toBe("set-complete");
    expect(next.pendingCoachCommandForSchoolId).toBeNull();
    expect(next.eventLog).toHaveLength(eventCount);
    expect(next.currentSetNumber).toBe(1);
  });
});
