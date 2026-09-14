import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import {
  isWeeklyActionCompleted,
  markWeeklyActionCompleted,
} from "../../../src/domain/calendar/weekProgression";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import {
  advanceOfficialTournamentsThroughWeek,
  findDueUserOfficialMatch,
} from "../../../src/domain/tournament/progressOfficialTournaments";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  applyGameAction,
  GameRuleConflictError,
  type AppliedGameAction,
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

function officialWeekSnapshot(): CloudGameSnapshot {
  const snapshot = createSnapshot();
  let state = {
    ...snapshot.state,
    calendar: {
      ...snapshot.state.calendar,
      weekOfYear: 9,
    },
  };
  state = advanceOfficialTournamentsThroughWeek(state);
  state = markWeeklyActionCompleted(state, "training");
  if (!findDueUserOfficialMatch(state)) {
    throw new Error("official match fixture did not produce a due user match");
  }

  return {
    ...snapshot,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function completeOfficialMatch(snapshot: CloudGameSnapshot): AppliedGameAction {
  let applied = applyGameAction(snapshot, { type: "official-match" });

  for (let guard = 0; guard < 8; guard += 1) {
    if (applied.state.activeMatch?.phase === "match-complete") {
      return applied;
    }
    if (applied.state.activeMatch?.phase !== "coach-decision") {
      throw new Error("official match did not stop at a coach decision");
    }

    applied = applyGameAction(
      {
        ...snapshot,
        state: applied.state,
        teamSelection: applied.teamSelection,
      },
      { type: "match-command", command: { type: "continue" } },
    );
  }

  throw new Error("official match did not complete within guard limit");
}

describe("Phase19 authoritative match experience", () => {
  it("grants match-type experience once at completed practice-match boundary and excludes non-participants", () => {
    const snapshot = createSnapshot();
    schedulePracticeOpponent(snapshot);

    const starterId = snapshot.teamSelection.rotation[0]!.playerId;
    const selectedIds = new Set([
      ...snapshot.teamSelection.rotation.map(
        (assignment) => assignment.playerId,
      ),
      snapshot.teamSelection.liberoPlayerId!,
    ]);
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const nonParticipantId = school.playerIds.find(
      (id) => !selectedIds.has(id),
    );
    if (!nonParticipantId) {
      throw new Error("non-participant fixture missing");
    }
    snapshot.teamSelection.benchPlayerIds = [];

    for (const id of [starterId, nonParticipantId]) {
      const current = snapshot.state.players[id]!;
      snapshot.state.players[id] = {
        ...current,
        growthTypeId: "growth.match",
        potential: 100,
        abilities: {
          ...current.abilities,
          decision: 50,
        },
      };
    }

    const result = applyGameAction(snapshot, { type: "practice-match" });

    expect(isWeeklyActionCompleted(result.state, "practice-match")).toBe(true);
    expect(result.state.players[starterId]!.abilities.decision).toBe(52);
    expect(result.state.players[nonParticipantId]!.abilities.decision).toBe(50);

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

  it("grants the same bounded experience only when an official match completes", () => {
    const snapshot = officialWeekSnapshot();
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

    const started = applyGameAction(snapshot, { type: "official-match" });
    expect(started.state.players[starterId]!.abilities.decision).toBe(50);

    const result = completeOfficialMatch(snapshot);
    expect(result.state.activeMatch?.phase).toBe("match-complete");
    expect(result.state.players[starterId]!.abilities.decision).toBe(52);
    expect(findDueUserOfficialMatch(result.state)).toBeNull();

    const completedSnapshot: CloudGameSnapshot = {
      ...snapshot,
      state: result.state,
      teamSelection: result.teamSelection,
    };
    expect(() =>
      applyGameAction(completedSnapshot, {
        type: "match-command",
        command: { type: "continue" },
      }),
    ).toThrowError(GameRuleConflictError);
    expect(result.state.players[starterId]!.abilities.decision).toBe(52);
  });
});
