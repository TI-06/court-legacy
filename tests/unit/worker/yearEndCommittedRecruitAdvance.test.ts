import { describe, expect, it } from "vitest";
import type { AdvanceWeekOutcome } from "../../../src/domain/calendar/advanceWeekOutcome";
import { isWeeklyActionCompleted } from "../../../src/domain/calendar/weekProgression";
import { createDemoGame } from "../../../src/app/createDemoGame";
import type { Player } from "../../../src/domain/model/Player";
import { playerId } from "../../../src/domain/model/identifiers";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import type { AppliedGameAction } from "../../../worker/game/applyGameAction";
import { applyServerGameAction } from "../../../worker/game/applyServerGameAction";

function createYearEndSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  state.date = "2029-03-28";
  state.calendar.currentDate = state.date;
  state.calendar.weekOfYear = 52;
  state.calendar.academicYear = 2028;
  state.calendar.completedActivityIds =
    state.calendar.completedActivityIds.filter(
      (id) => !id.startsWith(`week:${state.date}:`),
    );
  state.weeklySchedule.practiceMatch = {
    ...state.weeklySchedule.practiceMatch,
    scheduledOpponentId: null,
    scheduledBy: null,
  };

  return {
    userId: "user-year-end-advance",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision: 300,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function committedCandidate(snapshot: CloudGameSnapshot): Player {
  const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
  const source = snapshot.state.players[school.playerIds[0]!]!;
  return {
    ...structuredClone(source),
    id: playerId("committed-year-end-candidate"),
    grade: 1,
    career: {
      ...source.career,
      schoolId: snapshot.state.userSchoolId,
      enrolledYear: snapshot.state.calendar.academicYear + 1,
    },
  };
}

function snapshotAfter(
  previous: CloudGameSnapshot,
  applied: AppliedGameAction,
): CloudGameSnapshot {
  return {
    ...previous,
    revision: previous.revision + 1,
    state: applied.state,
    teamSelection: applied.teamSelection,
  };
}

function finishPracticeMatch(
  initial: CloudGameSnapshot,
  first: AppliedGameAction,
): CloudGameSnapshot {
  let snapshot = snapshotAfter(initial, first);
  for (let guard = 0; guard < 10; guard += 1) {
    if (isWeeklyActionCompleted(snapshot.state, "practice-match")) {
      return snapshot;
    }
    const next = applyServerGameAction(snapshot, {
      type: "match-command",
      command: { type: "continue" },
    });
    snapshot = snapshotAfter(snapshot, next);
  }
  throw new Error("practice match did not complete within command guard");
}

describe("year-end advance with committed recruits", () => {
  it("auto-runs weekly training and crosses the academic year instead of deadlocking", () => {
    const snapshot = createYearEndSnapshot();
    const candidate = committedCandidate(snapshot);

    const applied = applyServerGameAction(
      snapshot,
      { type: "advance-week" },
      {
        userIntake: [candidate],
      },
    );
    const outcome = applied.outcome as AdvanceWeekOutcome;

    expect(outcome.weekAdvanced).toBe(true);
    expect(outcome.trainingResult).toBeDefined();
    expect(outcome.academicYearTransition?.intakePlayerIds).toContain(
      candidate.id,
    );
    expect(applied.state.date).toBe("2029-04-04");
    expect(applied.state.calendar.weekOfYear).toBe(1);
    expect(
      applied.state.schools[applied.state.userSchoolId]!.playerIds,
    ).toContain(candidate.id);
  });

  it("keeps the normal training -> practice match -> rollover flow at week 52", () => {
    const snapshot = createYearEndSnapshot();
    const candidate = committedCandidate(snapshot);
    const opponent = Object.values(snapshot.state.schools).find(
      (school) => school.id !== snapshot.state.userSchoolId,
    )!;
    snapshot.state.weeklySchedule.practiceMatch = {
      ...snapshot.state.weeklySchedule.practiceMatch,
      scheduledOpponentId: opponent.id,
      scheduledBy: "outgoing",
    };

    const first = applyServerGameAction(
      snapshot,
      { type: "advance-week" },
      {
        userIntake: [candidate],
      },
    );
    const firstOutcome = first.outcome as AdvanceWeekOutcome;

    expect(firstOutcome.weekAdvanced).toBe(false);
    expect(firstOutcome.trainingResult).toBeDefined();
    expect(firstOutcome.pendingMatchPresentation?.kind).toBe("practice");
    expect(isWeeklyActionCompleted(first.state, "training")).toBe(true);
    expect(isWeeklyActionCompleted(first.state, "practice-match")).toBe(false);
    expect(first.state.activeMatch?.phase).toBe("coach-decision");
    expect(first.state.date).toBe("2029-03-28");

    const completed = finishPracticeMatch(snapshot, first);
    expect(isWeeklyActionCompleted(completed.state, "practice-match")).toBe(
      true,
    );
    expect(completed.state.date).toBe("2029-03-28");

    const second = applyServerGameAction(
      completed,
      { type: "advance-week" },
      { userIntake: [candidate] },
    );
    const secondOutcome = second.outcome as AdvanceWeekOutcome;

    expect(secondOutcome.weekAdvanced).toBe(true);
    expect(secondOutcome.academicYearTransition?.intakePlayerIds).toContain(
      candidate.id,
    );
    expect(second.state.date).toBe("2029-04-04");
  });
});
