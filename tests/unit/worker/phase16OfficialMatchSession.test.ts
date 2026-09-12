import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import type { AdvanceWeekOutcome } from "../../../src/domain/calendar/advanceWeekOutcome";
import { markWeeklyActionCompleted } from "../../../src/domain/calendar/weekProgression";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import {
  advanceOfficialTournamentsThroughWeek,
  findDueUserOfficialMatch,
} from "../../../src/domain/tournament/progressOfficialTournaments";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { applyGameAction } from "../../../worker/game/applyGameAction";

function officialWeekSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase16-official-session",
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

  let officialState = {
    ...state,
    calendar: {
      ...state.calendar,
      weekOfYear: 9,
    },
  };
  officialState = advanceOfficialTournamentsThroughWeek(officialState);
  officialState = markWeeklyActionCompleted(officialState, "training");

  if (!findDueUserOfficialMatch(officialState)) {
    throw new Error("official fixture did not produce a due match");
  }

  return {
    userId: "phase16-official-user",
    schoolDbId: "00000000-0000-4000-8000-000000000616",
    revision: 16,
    state: officialState,
    teamSelection: autoSelectTeam({
      state: officialState,
      schoolId: officialState.userSchoolId,
    }),
  };
}

function nextContinueLabel(
  reason: "opponent-run" | "set-break" | null,
): "continue" {
  if (reason !== "opponent-run" && reason !== "set-break") {
    throw new Error(`unexpected official decision reason: ${String(reason)}`);
  }
  return "continue";
}

describe("Phase16 official match sessions", () => {
  it("starts a due official match as an unresolved authoritative session without finalizing the bracket", () => {
    const snapshot = officialWeekSnapshot();
    const due = findDueUserOfficialMatch(snapshot.state)!;
    const historyBefore = snapshot.state.history.matches.length;
    const cursorBefore = snapshot.state.randomCursor;

    const started = applyGameAction(snapshot, { type: "advance-week" });
    const outcome = started.outcome as AdvanceWeekOutcome;
    const presentation = outcome.pendingMatchPresentation;

    expect(outcome.weekAdvanced).toBe(false);
    expect(presentation?.kind).toBe("official");
    expect(presentation?.simulation.analysis).toBeNull();
    expect(started.state.activeMatch?.id).toBe(due.match.id);
    expect(started.state.activeMatch?.phase).toBe("coach-decision");
    expect(started.state.activeMatch?.pendingCoachCommandForSchoolId).toBe(
      snapshot.state.userSchoolId,
    );
    expect(started.state.activeMatch?.runtime?.controlledSchoolId).toBe(
      snapshot.state.userSchoolId,
    );
    expect(started.state.randomCursor).toBe(cursorBefore);
    expect(started.state.history.matches).toHaveLength(historyBefore);
    expect(
      started.state.officialSeason.interhigh.prefectural.matches.find(
        (match) => match.id === due.match.id,
      )?.status,
    ).not.toBe("completed");
  });

  it("resumes the same official match through commands and finalizes tournament history exactly once", () => {
    const snapshot = officialWeekSnapshot();
    const due = findDueUserOfficialMatch(snapshot.state)!;
    const persistentSelection = structuredClone(snapshot.teamSelection);
    const persistentTactics = structuredClone(
      snapshot.state.schools[snapshot.state.userSchoolId]!.tactics,
    );
    const historyBefore = snapshot.state.history.matches.length;

    let applied = applyGameAction(snapshot, { type: "advance-week" });
    const matchId = applied.state.activeMatch?.id;
    expect(matchId).toBe(due.match.id);

    for (let guard = 0; guard < 8; guard += 1) {
      const active = applied.state.activeMatch;
      if (!active) throw new Error("official active match disappeared");
      if (active.phase === "match-complete") break;

      nextContinueLabel(active.runtime?.pendingDecisionReason ?? null);
      applied = applyGameAction(
        {
          ...snapshot,
          state: applied.state,
          teamSelection: applied.teamSelection,
        },
        { type: "match-command", command: { type: "continue" } },
      );

      expect(applied.state.activeMatch?.id).toBe(matchId);
      expect(applied.teamSelection).toEqual(persistentSelection);
      expect(
        applied.state.schools[applied.state.userSchoolId]!.tactics,
      ).toEqual(persistentTactics);
    }

    expect(applied.state.activeMatch?.phase).toBe("match-complete");
    expect(applied.state.history.matches).toHaveLength(historyBefore + 1);
    expect(
      applied.state.history.matches.filter(
        (match) => match.matchId === matchId,
      ),
    ).toHaveLength(1);
    expect(
      applied.state.officialSeason.interhigh.prefectural.matches.find(
        (match) => match.id === due.match.id,
      )?.status,
    ).toBe("completed");
  });
});
