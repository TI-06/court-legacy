import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { isWeeklyActionCompleted } from "../../../src/domain/calendar/weekProgression";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  applyGameAction,
  GameRuleConflictError,
} from "../../../worker/game/applyGameAction";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase19-match-experience",
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
    userId: "phase19-user",
    schoolDbId: "00000000-0000-4000-8000-000000000019",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function schedulePracticeOpponent(snapshot: CloudGameSnapshot): void {
  const opponent = Object.values(snapshot.state.schools).find(
    (school) => school.id !== snapshot.state.userSchoolId,
  );
  if (!opponent) throw new Error("practice opponent fixture missing");
  snapshot.state.weeklySchedule.practiceMatch.scheduledOpponentId = opponent.id;
  snapshot.state.weeklySchedule.practiceMatch.scheduledBy = "outgoing";
}

describe("Phase19 authoritative match experience", () => {
  it("grants match-type experience once at completed practice-match boundary", () => {
    const snapshot = createSnapshot();
    schedulePracticeOpponent(snapshot);

    const starterId = snapshot.teamSelection.rotation[0]!.playerId;
    const starter = snapshot.state.players[starterId]!;
    snapshot.state.players[starterId] = {
      ...starter,
      growthTypeId: "growth.match",
      potential: 100,
      abilities: {
        ...starter.abilities,
        decision: 50,
      },
    };

    const result = applyGameAction(snapshot, { type: "practice-match" });

    expect(isWeeklyActionCompleted(result.state, "practice-match")).toBe(true);
    expect(result.state.players[starterId]!.abilities.decision).toBe(52);

    const completedSnapshot: CloudGameSnapshot = {
      ...snapshot,
      state: result.state,
      teamSelection: result.teamSelection,
    };
    expect(() =>
      applyGameAction(completedSnapshot, { type: "practice-match" }),
    ).toThrowError(GameRuleConflictError);
    expect(result.state.players[starterId]!.abilities.decision).toBe(52);
  });
});
