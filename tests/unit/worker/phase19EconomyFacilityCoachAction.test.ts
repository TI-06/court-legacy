import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { applyGameAction } from "../../../worker/game/applyGameAction";
import { gameActionRequestSchema } from "../../../worker/game/actionSchema";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase19-3-worker",
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
    userId: "phase19-3-user",
    schoolDbId: "00000000-0000-4000-8000-000000000019",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

describe("Phase19 PR19-3 Worker action contract", () => {
  it("accepts explicit +5/+10 levels while keeping missing levels backward compatible", () => {
    const base = { operationId: "phase19-3", revision: 1 };
    expect(
      gameActionRequestSchema.parse({
        ...base,
        action: {
          type: "facility-upgrade",
          facility: "trainingRoom",
          levels: 10,
        },
      }).action,
    ).toMatchObject({ type: "facility-upgrade", levels: 10 });
    expect(
      gameActionRequestSchema.parse({
        ...base,
        action: { type: "facility-upgrade", facility: "trainingRoom" },
      }).action,
    ).toEqual({ type: "facility-upgrade", facility: "trainingRoom" });
  });

  it("applies an atomic +5 facility upgrade through the authoritative action", () => {
    const snapshot = createSnapshot();
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    snapshot.state.schools[snapshot.state.userSchoolId] = {
      ...school,
      funds: 1000,
    };

    const applied = applyGameAction(snapshot, {
      type: "facility-upgrade",
      facility: "trainingRoom",
      levels: 5,
    });
    expect(
      applied.state.schools[applied.state.userSchoolId]!.facilities
        .trainingRoom,
    ).toBe(5);
    expect(applied.state.schools[applied.state.userSchoolId]!.funds).toBe(619);
  });

  it("rejects a second assistant coach contract in the same academic year", () => {
    const snapshot = createSnapshot();
    const first = applyGameAction(snapshot, {
      type: "assistant-coach-contract",
      rank: "beginner",
      specialty: null,
    });

    expect(() =>
      applyGameAction(
        { ...snapshot, state: first.state },
        {
          type: "assistant-coach-contract",
          rank: "intermediate",
          specialty: "attack",
        },
      ),
    ).toThrow(/今年度のコーチ契約は完了しています/);
  });
});
