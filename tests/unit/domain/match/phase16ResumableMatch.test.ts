import { describe, expect, it } from "vitest";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import {
  resumeMatch,
  startMatch,
} from "../../../../src/domain/match/simulateMatch";
import type {
  CoachDecisionReason,
  MatchCommand,
  MatchRuntimeState,
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
    expect(step.match.eventLog.some((event) => event.type === "match-end")).toBe(
      false,
    );

    if (step.match.runtime?.pendingDecisionReason === "opponent-run") {
      expect(step.match.eventLog.at(-1)?.type).toBe("point");
    } else {
      expect(step.match.runtime?.pendingDecisionReason).toBe("set-break");
      expect(step.match.eventLog.at(-1)?.type).toBe("set-end");
    }
  });

  it("opens an opponent-run decision exactly when the opponent reaches four straight points", () => {
    const context = createContext("phase16-run-world");
    let found: ReturnType<typeof startInteractive> | null = null;

    for (let index = 0; index < 160; index += 1) {
      const candidate = startInteractive(context, `phase16-run-${index}`);
      if (candidate.match.runtime?.pendingDecisionReason === "opponent-run") {
        found = candidate;
        break;
      }
    }

    expect(found).not.toBeNull();
    const pointEvents = found!.match.eventLog.filter(
      (event) => event.type === "point",
    );
    const lastFour = pointEvents.slice(-4);

    expect(lastFour).toHaveLength(4);
    expect(
      lastFour.every(
        (event) =>
          event.setNumber === found!.match.currentSetNumber &&
          event.winnerSchoolId === context.awaySchoolId,
      ),
    ).toBe(true);
    expect(found!.match.runtime?.runLength).toBe(4);
  });

  it("uses a set-break decision after a non-final set without starting the next set", () => {
    const context = makeHomeDominant(createContext("phase16-break-world"));
    const step = startInteractive(context, "phase16-break-random");

    expect(step.match.phase).toBe("coach-decision");
    expect(step.match.runtime?.pendingDecisionReason).toBe("set-break");
    expect(step.match.sets).toHaveLength(1);
    expect(step.match.eventLog.at(-1)?.type).toBe("set-end");
    expect(
      step.match.eventLog.some((event) => event.setNumber === 2),
    ).toBe(false);
    expect(step.match.homeSetsWon).toBe(1);
    expect(step.match.awaySetsWon).toBe(0);
  });

  it("does not resume through an unresolved coach decision", () => {
    const context = createContext("phase16-unresolved-world");
    const step = startInteractive(context, "phase16-unresolved-random");
    const cursor = step.match.randomCursor;
    const snapshot = structuredClone(step.match);

    expect(() => resumeMatch({ state: context.state, match: step.match })).toThrow(
      /coach decision/i,
    );
    expect(step.match).toEqual(snapshot);
    expect(step.match.randomCursor).toBe(cursor);
  });
});
