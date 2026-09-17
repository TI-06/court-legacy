import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import type { PendingMatchPresentation } from "../../../src/domain/calendar/advanceWeekOutcome";
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
    seed: "phase22-official-skip",
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
    calendar: { ...state.calendar, weekOfYear: 9 },
  };
  officialState = advanceOfficialTournamentsThroughWeek(officialState);
  officialState = markWeeklyActionCompleted(officialState, "training");

  if (!findDueUserOfficialMatch(officialState)) {
    throw new Error("official fixture did not produce a due match");
  }

  return {
    userId: "phase22-official-user",
    schoolDbId: "00000000-0000-4000-8000-000000002202",
    revision: 22,
    state: officialState,
    teamSelection: autoSelectTeam({
      state: officialState,
      schoolId: officialState.userSchoolId,
    }),
  };
}

describe("Phase22 authoritative match skip", () => {
  it("finishes the same official session in one command without adding later human decisions", () => {
    const snapshot = officialWeekSnapshot();
    const historyBefore = snapshot.state.history.matches.length;
    const started = applyGameAction(snapshot, { type: "advance-week" });
    const before = started.state.activeMatch;
    if (!before?.runtime) throw new Error("official match did not start");

    const skipped = applyGameAction(
      {
        ...snapshot,
        state: started.state,
        teamSelection: started.teamSelection,
      },
      { type: "match-command", command: { type: "skip-to-result" } },
    );
    const presentation = skipped.outcome as PendingMatchPresentation;
    const after = skipped.state.activeMatch;

    expect(after?.phase).toBe("match-complete");
    expect(after?.id).toBe(before.id);
    expect(after?.randomSeed).toBe(before.randomSeed);
    expect(after?.randomCursor).toBeGreaterThanOrEqual(before.randomCursor);
    expect(after?.runtime?.controlledSchoolId).toBeNull();
    expect(presentation.simulation.analysis).not.toBeNull();
    expect(presentation.simulation.match.id).toBe(before.id);
    expect(presentation.simulation.match.randomSeed).toBe(before.randomSeed);
    expect(skipped.state.history.matches).toHaveLength(historyBefore + 1);

    const humanCommands = after?.runtime?.commandHistory.filter(
      (record) => record.schoolId === snapshot.state.userSchoolId,
    );
    expect(humanCommands).toHaveLength(1);
    expect(humanCommands?.[0]?.command).toEqual({ type: "continue" });
  });
});
