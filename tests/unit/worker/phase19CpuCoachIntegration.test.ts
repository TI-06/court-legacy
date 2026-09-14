import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { markWeeklyActionCompleted } from "../../../src/domain/calendar/weekProgression";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import {
  advanceOfficialTournamentsThroughWeek,
  findDueUserOfficialMatch,
} from "../../../src/domain/tournament/progressOfficialTournaments";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  applyGameAction,
  buildCpuCoachPublicView,
  type AppliedGameAction,
} from "../../../worker/game/applyGameAction";

function createSnapshot(seed = "phase19-cpu-worker"): CloudGameSnapshot {
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
  return {
    userId: "phase19-cpu-user",
    schoolDbId: "00000000-0000-4000-8000-000000000194",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function practiceSnapshot(): CloudGameSnapshot {
  const snapshot = createSnapshot("phase19-cpu-practice");
  const opponent = Object.values(snapshot.state.schools).find(
    (school) => school.id !== snapshot.state.userSchoolId,
  );
  if (!opponent) throw new Error("practice opponent missing");
  snapshot.state.weeklySchedule.practiceMatch.scheduledOpponentId = opponent.id;
  snapshot.state.weeklySchedule.practiceMatch.scheduledBy = "outgoing";
  return snapshot;
}

function officialSnapshot(): CloudGameSnapshot {
  const snapshot = createSnapshot("phase19-cpu-official");
  let state = {
    ...snapshot.state,
    calendar: { ...snapshot.state.calendar, weekOfYear: 9 },
  };
  state = advanceOfficialTournamentsThroughWeek(state);
  state = markWeeklyActionCompleted(state, "training");
  if (!findDueUserOfficialMatch(state)) {
    throw new Error("official match fixture missing");
  }
  return {
    ...snapshot,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function continueToCompletion(
  original: CloudGameSnapshot,
  started: AppliedGameAction,
): AppliedGameAction {
  let current = started;
  for (let guard = 0; guard < 10; guard += 1) {
    if (current.state.activeMatch?.phase === "match-complete") return current;
    if (current.state.activeMatch?.phase !== "coach-decision") {
      throw new Error("PVE match did not stop at a user coach decision");
    }
    current = applyGameAction(
      {
        ...original,
        state: current.state,
        teamSelection: current.teamSelection,
      },
      { type: "match-command", command: { type: "continue" } },
    );
  }
  throw new Error("PVE match did not complete within guard");
}

function opponentId(result: AppliedGameAction) {
  const match = result.state.activeMatch;
  if (!match) throw new Error("active match missing");
  return match.homeSchoolId === result.state.userSchoolId
    ? match.awaySchoolId
    : match.homeSchoolId;
}

function automaticCommands(result: AppliedGameAction) {
  const opponent = opponentId(result);
  return (
    result.state.activeMatch?.runtime?.commandHistory.filter(
      (record) => record.schoolId === opponent,
    ) ?? []
  );
}

describe("Phase19-4 PVE CPU coach Worker integration", () => {
  it("runs the CPU coach in interactive practice matches", () => {
    const snapshot = practiceSnapshot();
    const started = applyGameAction(snapshot, { type: "advance-week" });
    const completed = continueToCompletion(snapshot, started);

    expect(automaticCommands(completed).length).toBeGreaterThan(0);
    expect(
      automaticCommands(completed).every((record) =>
        ["timeout", "set-match-tactics", "continue"].includes(
          record.command.type,
        ),
      ),
    ).toBe(true);
  });

  it("runs the CPU coach in interactive official matches", () => {
    const snapshot = officialSnapshot();
    const started = applyGameAction(snapshot, { type: "official-match" });
    const completed = continueToCompletion(snapshot, started);

    expect(automaticCommands(completed).length).toBeGreaterThan(0);
  });

  it("builds CPU decisions without depending on hidden user player abilities", () => {
    const snapshot = practiceSnapshot();
    const started = applyGameAction(snapshot, { type: "advance-week" });
    const match = started.state.activeMatch;
    if (!match?.runtime) throw new Error("practice match runtime missing");
    const cpuSchoolId = opponentId(started);

    const before = buildCpuCoachPublicView(started.state, match, cpuSchoolId);
    const altered = structuredClone(started.state);
    for (const playerId of altered.schools[altered.userSchoolId]!.playerIds) {
      const player = altered.players[playerId]!;
      altered.players[playerId] = {
        ...player,
        potential: player.potential === 1 ? 100 : 1,
        abilities: {
          ...player.abilities,
          spike: player.abilities.spike === 1 ? 100 : 1,
          receive: player.abilities.receive === 1 ? 100 : 1,
          decision: player.abilities.decision === 1 ? 100 : 1,
        },
      };
    }
    const after = buildCpuCoachPublicView(altered, match, cpuSchoolId);

    expect(after).toEqual(before);
  });
});
