import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  gameActionRequestSchema,
  type GameAction,
} from "../../../worker/game/actionSchema";
import { applyGameAction } from "../../../worker/game/applyGameAction";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase56-team-identity-action",
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
    userId: "phase56-team-identity-user",
    schoolDbId: "00000000-0000-4000-8000-000000000256",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

describe("Phase56 team identity action", () => {
  it("accepts only canonical team identity styles", () => {
    const parsed = gameActionRequestSchema.parse({
      operationId: "phase56-team-identity-operation",
      revision: 1,
      action: { type: "set-team-identity", style: "serve-block" },
    });

    expect(parsed.action).toEqual({
      type: "set-team-identity",
      style: "serve-block",
    });

    expect(() =>
      gameActionRequestSchema.parse({
        operationId: "phase56-team-identity-invalid",
        revision: 1,
        action: { type: "set-team-identity", style: "unknown-style" },
      }),
    ).toThrow();
  });

  it("persists identity without rewriting the current match tactics", () => {
    const snapshot = createSnapshot();
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const tacticsBefore = structuredClone(school.tactics);
    const schemaVersionBefore = snapshot.state.schemaVersion;
    const action: GameAction = {
      type: "set-team-identity",
      style: "quick-combination",
    };

    const result = applyGameAction(snapshot, action);

    expect(result.state.teamPlanning.teamIdentity).toEqual({
      style: "quick-combination",
      mastery: 30,
      weeksInStyle: 0,
      changeCount: 1,
    });
    expect(result.state.schools[result.state.userSchoolId]!.tactics).toEqual(
      tacticsBefore,
    );
    expect(result.state.schemaVersion).toBe(schemaVersionBefore);
    expect(result.outcome).toEqual({ style: "quick-combination" });
  });
});
