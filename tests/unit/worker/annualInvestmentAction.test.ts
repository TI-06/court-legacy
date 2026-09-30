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
    seed: "annual-investment-action",
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
    userId: "user-investment",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision: 7,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

describe("annual investment game action", () => {
  it("accepts annual investment actions in the API schema", () => {
    const parsed = gameActionRequestSchema.parse({
      operationId: "annual-invest-1",
      revision: 7,
      action: {
        type: "annual-investment",
        area: "specialist",
        specialistFocus: "attack",
      },
    });

    expect(parsed.action).toEqual({
      type: "annual-investment",
      area: "specialist",
      specialistFocus: "attack",
    });
  });

  it("spends school funds and persists the selected investment", () => {
    const snapshot = createSnapshot();
    const before = snapshot.state.schools[snapshot.state.userSchoolId]!.funds;

    const result = applyGameAction(snapshot, {
      type: "annual-investment",
      area: "training",
    });

    expect(result.state.schoolManagement.annualInvestment).toMatchObject({
      yearIndex: snapshot.state.yearIndex,
      trainingLevel: 1,
    });
    expect(result.state.schools[result.state.userSchoolId]!.funds).toBe(
      before - 180,
    );
  });

  it("requires a specialist focus", () => {
    const snapshot = createSnapshot();

    expect(() =>
      applyGameAction(snapshot, {
        type: "annual-investment",
        area: "specialist",
      }),
    ).toThrowError(GameRuleConflictError);
  });
});
