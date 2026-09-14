import { describe, expect, it } from "vitest";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import { applyMatchCommand } from "../../../../src/domain/match/applyMatchCommand";
import {
  resumeMatch,
  startMatch,
  type AutomaticCoachPolicy,
} from "../../../../src/domain/match/simulateMatch";
import { createAbilities } from "../../../../src/domain/model/Player";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";

if (!gameDataBootstrap.ok) throw new Error(gameDataBootstrap.message);
const data = gameDataBootstrap.data;

const userSchool = {
  name: "CPU戦術試験高校",
  shortName: "CPU戦術",
  regionId: "region.test",
  coachName: "戦術 監督",
  uniform: { primary: "#173B52", secondary: "#F4F7F8", accent: "#D89A2B" },
};

function context(seed: string) {
  const state = generateWorld({ seed, userSchool, data });
  const homeSchoolId = state.userSchoolId;
  const awaySchoolId = Object.values(state.schools).find(
    (school) => school.id !== homeSchoolId,
  )!.id;

  for (const playerId of state.schools[homeSchoolId]!.playerIds) {
    const player = state.players[playerId]!;
    state.players[playerId] = {
      ...player,
      abilities: createAbilities(98),
      condition: 100,
      injury: null,
      positionAptitudes: { OH: 98, MB: 98, OP: 98, S: 98, L: 98 },
    };
  }
  for (const playerId of state.schools[awaySchoolId]!.playerIds) {
    const player = state.players[playerId]!;
    state.players[playerId] = {
      ...player,
      abilities: createAbilities(18),
      condition: 50,
      injury: null,
      positionAptitudes: { OH: 18, MB: 18, OP: 18, S: 18, L: 18 },
    };
  }

  return {
    state,
    homeSchoolId,
    awaySchoolId,
    homeSelection: autoSelectTeam({ state, schoolId: homeSchoolId }),
    awaySelection: autoSelectTeam({ state, schoolId: awaySchoolId }),
  };
}

const adjustedPlan = {
  serve: "aggressive",
  attack: "quick",
  block: "commit",
} as const;

const tacticPolicy: AutomaticCoachPolicy = ({ reason }) =>
  reason === "set-break"
    ? { type: "set-match-tactics", plan: adjustedPlan }
    : { type: "continue" };

describe("Phase19-4 automatic CPU coach commands", () => {
  it("applies one authoritative CPU tactic change at a set break", () => {
    const fixture = context("phase19-auto-cpu");
    const step = startMatch({
      state: fixture.state,
      id: matchId("phase19-auto-cpu-match"),
      homeSchoolId: fixture.homeSchoolId,
      awaySchoolId: fixture.awaySchoolId,
      homeSelection: fixture.homeSelection,
      awaySelection: fixture.awaySelection,
      bestOfSets: 3,
      random: new SeededRandom("phase19-auto-cpu-random"),
      controlledSchoolId: fixture.homeSchoolId,
      automaticCoachSchoolId: fixture.awaySchoolId,
      automaticCoach: tacticPolicy,
    });

    expect(step.match.runtime?.pendingDecisionReason).toBe("set-break");
    expect(step.match.runtime?.awayTactics).toEqual(adjustedPlan);
    expect(
      step.match.runtime?.commandHistory.filter(
        (record) =>
          record.schoolId === fixture.awaySchoolId &&
          record.setNumber === 1 &&
          record.decisionReason === "set-break",
      ),
    ).toHaveLength(1);
    expect(
      step.match.eventLog.filter(
        (event) =>
          event.type === "tactic-change" &&
          event.winnerSchoolId === fixture.awaySchoolId,
      ),
    ).toHaveLength(1);
  });

  it("does not duplicate the same automatic set-break decision after resume", () => {
    const fixture = context("phase19-auto-cpu-resume");
    const first = startMatch({
      state: fixture.state,
      id: matchId("phase19-auto-cpu-resume-match"),
      homeSchoolId: fixture.homeSchoolId,
      awaySchoolId: fixture.awaySchoolId,
      homeSelection: fixture.homeSelection,
      awaySelection: fixture.awaySelection,
      bestOfSets: 3,
      random: new SeededRandom("phase19-auto-cpu-resume-random"),
      controlledSchoolId: fixture.homeSchoolId,
      automaticCoachSchoolId: fixture.awaySchoolId,
      automaticCoach: tacticPolicy,
    });
    const commanded = applyMatchCommand({
      state: fixture.state,
      match: first.match,
      schoolId: fixture.homeSchoolId,
      command: { type: "continue" },
    });
    const second = resumeMatch({
      state: fixture.state,
      match: commanded,
      automaticCoachSchoolId: fixture.awaySchoolId,
      automaticCoach: tacticPolicy,
    });

    const firstSetAutomaticCommands = second.match.runtime?.commandHistory.filter(
      (record) =>
        record.schoolId === fixture.awaySchoolId &&
        record.setNumber === 1 &&
        record.decisionReason === "set-break",
    );
    expect(firstSetAutomaticCommands).toHaveLength(1);
  });
});
