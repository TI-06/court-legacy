import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import type { SimulateMatchResult } from "../../../src/domain/match/simulateMatch";
import { selectPracticeOpponent } from "../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { applyGameAction } from "../../../worker/game/applyGameAction";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "scheduled-practice-opponent-fixture",
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

describe("scheduled practice opponent", () => {
  it("plays the school that was reserved instead of selecting a different rival", () => {
    const snapshot = createSnapshot();
    const legacyOpponent = selectPracticeOpponent(snapshot.state);
    const scheduledOpponent = Object.values(snapshot.state.schools).find(
      (school) =>
        school.id !== snapshot.state.userSchoolId &&
        school.id !== legacyOpponent.id,
    );
    if (!scheduledOpponent) {
      throw new Error("scheduled opponent fixture missing");
    }

    const scheduledSnapshot: CloudGameSnapshot = {
      ...snapshot,
      state: {
        ...snapshot.state,
        weeklySchedule: {
          ...snapshot.state.weeklySchedule,
          practiceMatch: {
            ...snapshot.state.weeklySchedule.practiceMatch,
            scheduledOpponentId: scheduledOpponent.id,
            scheduledBy: "outgoing",
          },
        },
      },
    };

    const result = applyGameAction(scheduledSnapshot, {
      type: "practice-match",
    });
    const simulation = result.outcome as SimulateMatchResult;

    expect(simulation.match.awaySchoolId).toBe(scheduledOpponent.id);
  });
});
