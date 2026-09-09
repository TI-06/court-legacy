import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import type { Player } from "../../../src/domain/model/Player";
import {
  deriveMatchTacticPlan,
  type MatchTacticPlan,
} from "../../../src/domain/team/matchTactics";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { PublishedPvpTeamSnapshot } from "../../../worker/data/PvPStore";
import { buildPvpSimulationState } from "../../../worker/pvp/buildPvpSimulationState";

const matchTactics: MatchTacticPlan = {
  serve: "aggressive",
  attack: "quick",
  block: "commit",
};

function defenderSnapshot(): PublishedPvpTeamSnapshot {
  const state = createDemoGame();
  const school = structuredClone(state.schools[state.userSchoolId]!);
  const players = Object.fromEntries(
    school.playerIds.map((id) => [id, structuredClone(state.players[id]!)]),
  ) as Record<string, Player>;

  return {
    id: "phase15-defender-snapshot",
    userId: "phase15-defender-user",
    sourceRevision: 8,
    sourceAcademicYear: state.calendar.academicYear,
    sourceYearIndex: state.yearIndex,
    school,
    players,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
    isActive: true,
    publishedAt: "2026-09-09T09:00:00.000Z",
  };
}

describe("Phase 15 PvP match-only tactics", () => {
  it("overrides only challenger tactics inside the isolated simulation state", () => {
    const challengerState = createDemoGame();
    const defender = defenderSnapshot();
    const challengerBefore = structuredClone(challengerState);
    const defenderBefore = structuredClone(defender);
    const defenderPlan = deriveMatchTacticPlan(defender.school.tactics);

    const result = buildPvpSimulationState({
      challenger: {
        userId: "phase15-challenger-user",
        state: challengerState,
        teamSelection: autoSelectTeam({
          state: challengerState,
          schoolId: challengerState.userSchoolId,
        }),
      },
      defender,
      matchTactics,
    });

    expect(
      deriveMatchTacticPlan(
        result.state.schools[result.challengerSchoolId]!.tactics,
      ),
    ).toEqual(matchTactics);
    expect(
      deriveMatchTacticPlan(
        result.state.schools[result.defenderSchoolId]!.tactics,
      ),
    ).toEqual(defenderPlan);
    expect(challengerState).toEqual(challengerBefore);
    expect(defender).toEqual(defenderBefore);
  });
});
