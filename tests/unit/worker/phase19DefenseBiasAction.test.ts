import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { deriveMatchTacticPlan } from "../../../src/domain/team/matchTactics";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  gameActionRequestSchema,
  type GameAction,
} from "../../../worker/game/actionSchema";
import { applyGameAction } from "../../../worker/game/applyGameAction";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase19-defense-action",
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
    userId: "phase19-defense-user",
    schoolDbId: "00000000-0000-4000-8000-000000000196",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

describe("Phase19-4 team defense coverage action", () => {
  it("accepts defense coverage as a separate authoritative game action", () => {
    const parsed = gameActionRequestSchema.parse({
      operationId: "phase19-defense-operation",
      revision: 1,
      action: { type: "set-team-defense-bias", defenseBias: "line" },
    });

    expect(parsed.action).toEqual({
      type: "set-team-defense-bias",
      defenseBias: "line",
    });
  });

  it("persists only defenseBias without expanding MatchTacticPlan", () => {
    const snapshot = createSnapshot();
    const schoolBefore = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const planBefore = deriveMatchTacticPlan(schoolBefore.tactics);
    const action: GameAction = {
      type: "set-team-defense-bias",
      defenseBias: "cross",
    };

    const result = applyGameAction(snapshot, action);
    const schoolAfter = result.state.schools[result.state.userSchoolId]!;

    expect(schoolAfter.tactics.defenseBias).toBe("cross");
    expect(deriveMatchTacticPlan(schoolAfter.tactics)).toEqual(planBefore);
    expect(
      Object.keys(deriveMatchTacticPlan(schoolAfter.tactics)).sort(),
    ).toEqual(["attack", "block", "serve"]);
  });
});
