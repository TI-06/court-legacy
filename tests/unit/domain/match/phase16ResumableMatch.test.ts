import { describe, expect, it } from "vitest";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import { applyMatchCommand } from "../../../../src/domain/match/applyMatchCommand";
import {
  resumeMatch,
  simulateMatch,
  startMatch,
} from "../../../../src/domain/match/simulateMatch";
import type {
  CoachDecisionReason,
  MatchCommand,
  MatchRuntimeState,
  MatchState,
} from "../../../../src/domain/model/Match";
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

function createContext(seed = "phase16-world") {
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

function makeHomeDominant(context: ReturnType<typeof createContext>) {
  for (const playerId of context.state.schools[context.homeSchoolId]!
    .playerIds) {
    context.state.players[playerId] = {
      ...context.state.players[playerId]!,
      abilities: createAbilities(98),
      condition: 100,
      fatigue: 0,
      injury: null,
      positionAptitudes: { OH: 98, MB: 98, OP: 98, S: 98, L: 98 },
    };
  }
  for (const playerId of context.state.schools[context.awaySchoolId]!
    .playerIds) {
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

function startInteractive(
  context: ReturnType<typeof createContext>,
  randomSeed: string,
) {
  return startMatch({
    state: context.state,
    id: matchId(`phase16-${randomSeed}`),
    homeSchoolId: context.homeSchoolId,
    awaySchoolId: context.awaySchoolId,
    homeSelection: context.homeSelection,
    awaySelection: context.awaySelection,
    bestOfSets: 3,
    random: new SeededRandom(randomSeed),
    controlledSchoolId: context.homeSchoolId,
  });
}

function findOpponentRunDecision(context: ReturnType<typeof createContext>) {
  for (let index = 0; index < 240; index += 1) {
    const step = startInteractive(context, `phase16-run-${index}`);
    if (step.match.runtime?.pendingDecisionReason === "opponent-run") {
      return step;
    }
  }
  throw new Error("test fixture could not find an opponent-run decision");
}

function playToCompletionWithContinue(
  context: ReturnType<typeof createContext>,
  randomSeed: string,
): MatchState {
  let step = startInteractive(context, randomSeed);
  let guard = 0;

  while (step.match.phase !== "match-complete") {
    guard += 1;
    if (guard > 12) {
      throw new Error(
        "interactive match did not complete within decision guard",
      );
    }
    const commanded = applyMatchCommand({
      state: context.state,
      match: step.match,
      schoolId: context.homeSchoolId,
      command: { type: "continue" },
    });
    step = resumeMatch({ state: context.state, match: commanded });
  }

  return step.match;
}

describe("Phase16 resumable match API", () => {
  it("exports the high-level resumable match contract", () => {
    const reason: CoachDecisionReason = "opponent-run";
    const command: MatchCommand = { type: "continue" };
    const runtime = null as unknown as MatchRuntimeState;

    expect(reason).toBe("opponent-run");
    expect(command.type).toBe("continue");
    expect(runtime).toBeNull();
    expect(startMatch).toBeTypeOf("function");
    expect(resumeMatch).toBeTypeOf("function");
  });

  it("stops before precomputing events beyond the first user decision", () => {
    const context = createContext("phase16-stop-world");
    const step = startInteractive(context, "phase16-stop-random");

    expect(step.analysis).toBeNull();
    expect(step.match.phase).toBe("coach-decision");
    expect(step.match.pendingCoachCommandForSchoolId).toBe(
      context.homeSchoolId,
    );
    expect(step.match.runtime?.pendingDecisionReason).not.toBeNull();
    expect(
      step.match.eventLog.some((event) => event.type === "match-end"),
    ).toBe(false);

    if (
      step.match.runtime?.pendingDecisionReason === "opponent-run" ||
      step.match.runtime?.pendingDecisionReason === "critical-score"
    ) {
      expect(step.match.eventLog.at(-1)?.type).toBe("point");
    } else {
      expect(step.match.runtime?.pendingDecisionReason).toBe("set-break");
      expect(step.match.eventLog.at(-1)?.type).toBe("set-end");
    }
  });

  it("opens an opponent-run decision exactly when the opponent reaches four straight points", () => {
    const context = createContext("phase16-run-world");
    const found = findOpponentRunDecision(context);
    const pointEvents = found.match.eventLog.filter(
      (event) => event.type === "point",
    );
    const lastFour = pointEvents.slice(-4);

    expect(lastFour).toHaveLength(4);
    expect(
      lastFour.every(
        (event) =>
          event.setNumber === found.match.currentSetNumber &&
          event.winnerSchoolId === context.awaySchoolId,
      ),
    ).toBe(true);
    expect(found.match.runtime?.runLength).toBe(4);
  });

  it("does not open a second opponent-run decision in the same set after continue", () => {
    const context = createContext("phase16-single-run-world");
    const first = findOpponentRunDecision(context);
    const commanded = applyMatchCommand({
      state: context.state,
      match: first.match,
      schoolId: context.homeSchoolId,
      command: { type: "continue" },
    });
    let next = resumeMatch({ state: context.state, match: commanded });
    while (
      next.match.phase !== "match-complete" &&
      next.match.runtime?.pendingDecisionReason === "critical-score"
    ) {
      const continued = applyMatchCommand({
        state: context.state,
        match: next.match,
        schoolId: context.homeSchoolId,
        command: { type: "continue" },
      });
      next = resumeMatch({ state: context.state, match: continued });
    }

    expect(next.match.runtime?.pendingDecisionReason).not.toBe("opponent-run");
    expect(next.match.runtime?.opponentRunDecisionConsumed).toBe(true);
  });

  it("opens one critical-score decision in a close set before the result is known", () => {
    const context = createContext("phase30-critical-world");

    let found: ReturnType<typeof startInteractive> | null = null;
    for (let index = 0; index < 320; index += 1) {
      let step = startInteractive(context, `phase30-critical-${index}`);
      let guard = 0;
      while (step.match.phase !== "match-complete" && guard < 8) {
        guard += 1;
        if (step.match.runtime?.pendingDecisionReason === "critical-score") {
          found = step;
          break;
        }
        const commanded = applyMatchCommand({
          state: context.state,
          match: step.match,
          schoolId: context.homeSchoolId,
          command: { type: "continue" },
        });
        step = resumeMatch({ state: context.state, match: commanded });
      }
      if (found) break;
    }

    expect(found).not.toBeNull();
    expect(found!.analysis).toBeNull();
    expect(found!.match.phase).toBe("coach-decision");
    expect(found!.match.runtime?.pendingDecisionReason).toBe("critical-score");
    expect(
      Math.max(
        found!.match.runtime!.homeScore,
        found!.match.runtime!.awayScore,
      ),
    ).toBeGreaterThanOrEqual(
      found!.match.currentSetNumber === found!.match.bestOfSets ? 10 : 20,
    );
    expect(
      Math.abs(
        found!.match.runtime!.homeScore - found!.match.runtime!.awayScore,
      ),
    ).toBeLessThanOrEqual(2);
    expect(
      found!.match.eventLog.some((event) => event.type === "match-end"),
    ).toBe(false);
  });

  it("uses a set-break decision after a non-final set without starting the next set", () => {
    const context = makeHomeDominant(createContext("phase16-break-world"));
    const step = startInteractive(context, "phase16-break-random");

    expect(step.match.phase).toBe("coach-decision");
    expect(step.match.runtime?.pendingDecisionReason).toBe("set-break");
    expect(step.match.sets).toHaveLength(1);
    expect(step.match.eventLog.at(-1)?.type).toBe("set-end");
    expect(step.match.eventLog.some((event) => event.setNumber === 2)).toBe(
      false,
    );
    expect(step.match.homeSetsWon).toBe(1);
    expect(step.match.awaySetsWon).toBe(0);
  });

  it("starts the next set only after a set-break command is accepted", () => {
    const context = makeHomeDominant(createContext("phase16-next-set-world"));
    const first = startInteractive(context, "phase16-next-set-random");
    expect(first.match.runtime?.pendingDecisionReason).toBe("set-break");

    const commanded = applyMatchCommand({
      state: context.state,
      match: first.match,
      schoolId: context.homeSchoolId,
      command: { type: "continue" },
    });
    const second = resumeMatch({ state: context.state, match: commanded });

    expect(second.match.currentSetNumber).toBeGreaterThanOrEqual(2);
    expect(second.match.eventLog.some((event) => event.setNumber === 2)).toBe(
      true,
    );
    expect(second.match.sets[0]).toEqual(first.match.sets[0]);
  });

  it("does not resume through an unresolved coach decision", () => {
    const context = createContext("phase16-unresolved-world");
    const step = startInteractive(context, "phase16-unresolved-random");
    const cursor = step.match.randomCursor;
    const snapshot = structuredClone(step.match);

    expect(() =>
      resumeMatch({ state: context.state, match: step.match }),
    ).toThrow(/coach decision/i);
    expect(step.match).toEqual(snapshot);
    expect(step.match.randomCursor).toBe(cursor);
  });

  it("replays an identical interactive command sequence exactly", () => {
    const context = createContext("phase16-replay-world");
    const first = playToCompletionWithContinue(
      context,
      "phase16-replay-random",
    );
    const second = playToCompletionWithContinue(
      context,
      "phase16-replay-random",
    );

    expect(first).toEqual(second);
    expect(first.phase).toBe("match-complete");
    expect(first.runtime?.commandHistory.length).toBeGreaterThanOrEqual(1);
  });

  it("expires a timeout boost before the next decision boundary", () => {
    const context = createContext("phase16-timeout-expiry-world");
    const first = findOpponentRunDecision(context);
    const timedOut = applyMatchCommand({
      state: context.state,
      match: first.match,
      schoolId: context.homeSchoolId,
      command: { type: "timeout" },
    });
    expect(timedOut.runtime?.timeoutBoost?.ralliesRemaining).toBe(5);

    const next = resumeMatch({ state: context.state, match: timedOut });
    expect(next.match.runtime?.timeoutBoost).toBeNull();
    expect(next.match.runtime?.pendingDecisionReason).not.toBe("opponent-run");
  });

  it("keeps tactics changes future-only and persistent school tactics untouched", () => {
    const context = createContext("phase16-future-tactics-world");
    const first = findOpponentRunDecision(context);
    const prefix = structuredClone(first.match.eventLog);
    const schoolTactics = structuredClone(
      context.state.schools[context.homeSchoolId]!.tactics,
    );
    const changed = applyMatchCommand({
      state: context.state,
      match: first.match,
      schoolId: context.homeSchoolId,
      command: {
        type: "set-match-tactics",
        plan: { serve: "aggressive", attack: "quick", block: "commit" },
      },
    });
    const next = resumeMatch({ state: context.state, match: changed });

    expect(next.match.eventLog.slice(0, prefix.length)).toEqual(prefix);
    expect(context.state.schools[context.homeSchoolId]!.tactics).toEqual(
      schoolTactics,
    );
  });

  it("preserves the existing one-shot simulateMatch contract without runtime state", () => {
    const context = createContext("phase16-compat-world");
    const stateBefore = structuredClone(context.state);
    const homeBefore = structuredClone(context.homeSelection);
    const awayBefore = structuredClone(context.awaySelection);
    const execute = () =>
      simulateMatch({
        state: context.state,
        id: matchId("phase16-compat-match"),
        homeSchoolId: context.homeSchoolId,
        awaySchoolId: context.awaySchoolId,
        homeSelection: context.homeSelection,
        awaySelection: context.awaySelection,
        bestOfSets: 3,
        random: new SeededRandom("phase16-compat-random", 12),
      });

    const first = execute();
    const second = execute();

    expect(first).toEqual(second);
    expect(first.match.phase).toBe("match-complete");
    expect(first.analysis.winnerSchoolId).toBeTruthy();
    expect(first.match.runtime).toBeUndefined();
    expect(context.state).toEqual(stateBefore);
    expect(context.homeSelection).toEqual(homeBefore);
    expect(context.awaySelection).toEqual(awayBefore);
  });
});
