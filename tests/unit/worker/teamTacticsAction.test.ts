import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  applyGameAction,
  GameRuleConflictError,
} from "../../../worker/game/applyGameAction";
import { gameActionRequestSchema } from "../../../worker/game/actionSchema";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "team-tactics-action-fixture",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高橋 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });

  return {
    userId: "user-123",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision: 7,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

const aggressiveQuickCommit = {
  serve: "aggressive",
  attack: "quick",
  block: "commit",
} as const;

describe("set-team-tactics action", () => {
  it("accepts exactly the three public tactic enums and rejects unknown values", () => {
    const valid = gameActionRequestSchema.safeParse({
      operationId: "set-tactics-001",
      revision: 7,
      action: { type: "set-team-tactics", plan: aggressiveQuickCommit },
    });
    const invalid = gameActionRequestSchema.safeParse({
      operationId: "set-tactics-002",
      revision: 7,
      action: {
        type: "set-team-tactics",
        plan: { serve: "reckless", attack: "quick", block: "commit" },
      },
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("persists canonical tactics only to the authoritative user school", () => {
    const snapshot = createSnapshot();
    const userSchool = snapshot.state.schools[snapshot.state.userSchoolId]!;
    userSchool.tactics.serveTargetPlayerId = userSchool.playerIds[0]!;
    userSchool.tactics.defenseBias = "cross";
    const before = structuredClone(snapshot);
    const preservedTarget = userSchool.tactics.serveTargetPlayerId;
    const otherSchool = Object.values(snapshot.state.schools).find(
      (school) => school.id !== snapshot.state.userSchoolId,
    );
    if (!otherSchool) {
      throw new Error("opponent school fixture missing");
    }
    const otherTactics = structuredClone(otherSchool.tactics);
    const teamSelection = structuredClone(snapshot.teamSelection);

    const result = applyGameAction(snapshot, {
      type: "set-team-tactics",
      plan: aggressiveQuickCommit,
    } as never);
    const saved = result.state.schools[result.state.userSchoolId]!.tactics;

    expect(saved).toEqual({
      ...userSchool.tactics,
      serveRisk: 75,
      attackTempo: "fast",
      attackDistribution: { OH: 34, MB: 32, OP: 30, S: 4, L: 0 },
      blockSystem: "commit",
      serveTargetPlayerId: preservedTarget,
      defenseBias: "cross",
    });
    expect(result.state.schools[otherSchool.id]!.tactics).toEqual(otherTactics);
    expect(result.teamSelection).toEqual(teamSelection);
    expect(snapshot).toEqual(before);
  });

  it("rejects a missing authoritative user school instead of mutating another school", () => {
    const snapshot = createSnapshot();
    delete snapshot.state.schools[snapshot.state.userSchoolId];

    expect(() =>
      applyGameAction(snapshot, {
        type: "set-team-tactics",
        plan: aggressiveQuickCommit,
      } as never),
    ).toThrowError(GameRuleConflictError);
  });
});
