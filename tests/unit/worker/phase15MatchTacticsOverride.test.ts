import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import type { AdvanceWeekOutcome } from "../../../src/domain/calendar/advanceWeekOutcome";
import { applyMatchTacticPlan } from "../../../src/domain/team/matchTactics";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { gameActionRequestSchema } from "../../../worker/game/actionSchema";
import { applyServerGameAction } from "../../../worker/game/applyServerGameAction";

const overridePlan = {
  serve: "aggressive",
  attack: "quick",
  block: "commit",
} as const;

function createSnapshot(seed: string): CloudGameSnapshot {
  const state = createInitialGame({
    seed,
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
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function matchFrom(result: ReturnType<typeof applyServerGameAction>) {
  const outcome = result.outcome as AdvanceWeekOutcome | undefined;
  const presentation = outcome?.pendingMatchPresentation;
  if (!presentation) throw new Error("practice match was not simulated");
  return presentation.simulation.match;
}

describe("Phase 15 match-only tactics override", () => {
  it("accepts matchTactics independently from matchSelection", () => {
    const snapshot = createSnapshot("phase15-match-tactics-schema");

    expect(() =>
      gameActionRequestSchema.parse({
        operationId: "phase15-tactics-only",
        revision: snapshot.revision,
        action: { type: "advance-week", matchTactics: overridePlan },
      }),
    ).not.toThrow();
    expect(() =>
      gameActionRequestSchema.parse({
        operationId: "phase15-tactics-with-lineup",
        revision: snapshot.revision,
        action: {
          type: "advance-week",
          matchSelection: snapshot.teamSelection,
          matchTactics: overridePlan,
        },
      }),
    ).not.toThrow();
  });

  it(
    "uses temporary tactics for simulation without persisting or mutating them",
    () => {
      const temporary = createSnapshot("phase15-match-tactics-runtime");
      const persistent = createSnapshot("phase15-match-tactics-runtime");
      const before = structuredClone(temporary);
      const baselineTactics = structuredClone(
        temporary.state.schools[temporary.state.userSchoolId]!.tactics,
      );
      const persistentSchool =
        persistent.state.schools[persistent.state.userSchoolId]!;
      persistentSchool.tactics = applyMatchTacticPlan(
        persistentSchool.tactics,
        overridePlan,
      );

      const temporaryResult = applyServerGameAction(
        temporary,
        { type: "advance-week", matchTactics: overridePlan } as never,
      );
      const persistentResult = applyServerGameAction(persistent, {
        type: "advance-week",
      });

      expect(matchFrom(temporaryResult)).toEqual(matchFrom(persistentResult));
      expect(
        temporaryResult.state.schools[temporaryResult.state.userSchoolId]!
          .tactics,
      ).toEqual(baselineTactics);
      expect(temporary).toEqual(before);
    },
  );

  it("keeps existing baseline behavior when matchTactics is omitted", () => {
    const first = createSnapshot("phase15-match-tactics-omitted");
    const second = createSnapshot("phase15-match-tactics-omitted");

    const firstResult = applyServerGameAction(first, { type: "advance-week" });
    const secondResult = applyServerGameAction(second, {
      type: "advance-week",
    });

    expect(matchFrom(firstResult)).toEqual(matchFrom(secondResult));
  });
});
