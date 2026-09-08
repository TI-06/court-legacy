import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { buildPreMatchLineupPreset } from "../../../src/domain/match/preMatchLineup";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { applyGameAction } from "../../../worker/game/applyGameAction";
import { gameActionRequestSchema } from "../../../worker/game/actionSchema";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "pre-match-action",
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
  const teamSelection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const opponent = Object.values(state.schools).find(
    (school) => school.id !== state.userSchoolId,
  );
  if (!opponent) throw new Error("opponent fixture missing");
  state.weeklySchedule.practiceMatch.scheduledOpponentId = opponent.id;
  state.weeklySchedule.practiceMatch.scheduledBy = "outgoing";

  return {
    userId: "user-123",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision: 7,
    state,
    teamSelection,
  };
}

describe("match-only advance-week selection", () => {
  it("accepts matchSelection in the action contract", () => {
    const snapshot = createSnapshot();
    const matchSelection = buildPreMatchLineupPreset({
      state: snapshot.state,
      schoolId: snapshot.state.userSchoolId,
      baseSelection: snapshot.teamSelection,
      preset: "grade-1",
    });

    expect(() =>
      gameActionRequestSchema.parse({
        operationId: "operation-pre-match",
        revision: snapshot.revision,
        action: { type: "advance-week", matchSelection },
      }),
    ).not.toThrow();
  });

  it("uses the temporary lineup for the match without persisting it", () => {
    const snapshot = createSnapshot();
    const savedSelection = structuredClone(snapshot.teamSelection);
    const matchSelection = buildPreMatchLineupPreset({
      state: snapshot.state,
      schoolId: snapshot.state.userSchoolId,
      baseSelection: snapshot.teamSelection,
      preset: "grade-1",
    });

    const result = applyGameAction(snapshot, {
      type: "advance-week",
      matchSelection,
    });
    const outcome = result.outcome;
    if (!outcome || !("pendingMatchPresentation" in outcome)) {
      throw new Error("weekly match presentation missing");
    }
    const presentation = outcome.pendingMatchPresentation;
    if (!presentation) throw new Error("practice match was not simulated");

    expect(presentation.simulation.match.homeSelection).toEqual(matchSelection);
    expect(result.teamSelection).toEqual(savedSelection);
    expect(snapshot.teamSelection).toEqual(savedSelection);
  });
});
