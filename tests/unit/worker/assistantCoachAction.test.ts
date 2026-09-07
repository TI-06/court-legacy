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
    seed: "assistant-coach-fixture",
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

describe("assistant coach contract action", () => {
  it("accepts the approved contract action schema", () => {
    const parsed = gameActionRequestSchema.parse({
      operationId: "coach-contract-1",
      revision: 7,
      action: {
        type: "assistant-coach-contract",
        rank: "advanced",
        specialty: "attack",
      },
    });

    expect(parsed.action).toEqual({
      type: "assistant-coach-contract",
      rank: "advanced",
      specialty: "attack",
    });
  });

  it("contracts an advanced attack coach and records the annual payment", () => {
    const snapshot = createSnapshot();
    const before = snapshot.state.schools[snapshot.state.userSchoolId]!.funds;

    const result = applyGameAction(snapshot, {
      type: "assistant-coach-contract",
      rank: "advanced",
      specialty: "attack",
    } as never);

    expect(result.state.schoolManagement.assistantCoach).toEqual({
      rank: "advanced",
      specialty: "attack",
      contractYearIndex: snapshot.state.yearIndex,
    });
    expect(result.state.schools[result.state.userSchoolId]!.funds).toBe(
      before - 450,
    );
    expect(result.state.schoolManagement.fundsHistory.at(-1)).toMatchObject({
      kind: "assistant-coach",
      amount: -450,
      balanceAfter: before - 450,
    });
  });

  it("rejects a specialty-less advanced contract", () => {
    const snapshot = createSnapshot();

    expect(() =>
      applyGameAction(snapshot, {
        type: "assistant-coach-contract",
        rank: "advanced",
        specialty: null,
      } as never),
    ).toThrowError(GameRuleConflictError);
  });

  it("rejects a contract when funds are insufficient", () => {
    const snapshot = createSnapshot();
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    snapshot.state.schools[snapshot.state.userSchoolId] = {
      ...school,
      funds: 100,
    };

    expect(() =>
      applyGameAction(snapshot, {
        type: "assistant-coach-contract",
        rank: "master",
        specialty: "physical",
      } as never),
    ).toThrowError(GameRuleConflictError);
  });
});
