import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { markWeeklyActionCompleted } from "../../../src/domain/calendar/weekProgression";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import {
  advanceOfficialTournamentsThroughWeek,
  findDueUserOfficialMatch,
} from "../../../src/domain/tournament/progressOfficialTournaments";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { gameActionRequestSchema } from "../../../worker/game/actionSchema";
import {
  applyGameAction,
  GameRuleConflictError,
  type AppliedGameAction,
} from "../../../worker/game/applyGameAction";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "official-action-fixture",
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
    userId: "user-official",
    schoolDbId: "00000000-0000-4000-8000-000000000099",
    revision: 8,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function officialWeekSnapshot(options: {
  trained: boolean;
}): CloudGameSnapshot {
  const snapshot = createSnapshot();
  let state = {
    ...snapshot.state,
    calendar: {
      ...snapshot.state.calendar,
      weekOfYear: 9,
    },
  };
  state = advanceOfficialTournamentsThroughWeek(state);
  if (options.trained) {
    state = markWeeklyActionCompleted(state, "training");
  }
  const due = findDueUserOfficialMatch(state);
  if (!due) {
    throw new Error("official match fixture did not produce a due user match");
  }

  return {
    ...snapshot,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function expectConflict(callback: () => unknown, code: string): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(GameRuleConflictError);
    expect((error as GameRuleConflictError).code).toBe(code);
    return;
  }
  throw new Error(`expected GameRuleConflictError: ${code}`);
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

describe("official match action schema", () => {
  it("accepts only the official-match type and rejects client supplied authority fields", () => {
    const base = {
      operationId: "official-operation-001",
      revision: 8,
    };
    expect(
      gameActionRequestSchema.safeParse({
        ...base,
        action: { type: "official-match" },
      }).success,
    ).toBe(true);

    for (const extra of [
      { opponentId: "school-rival" },
      { tournamentId: "official:interhigh:1:prefectural" },
      { round: "round-of-16" },
      { seed: "client-seed" },
      { winnerSchoolId: "school-user" },
      { result: { homeSetsWon: 2, awaySetsWon: 0 } },
    ]) {
      expect(
        gameActionRequestSchema.safeParse({
          ...base,
          action: { type: "official-match", ...extra },
        }).success,
      ).toBe(false);
    }
  });

  it("accepts only a notification id when marking a notification read", () => {
    const base = {
      operationId: "notification-read-001",
      revision: 8,
    };

    expect(
      gameActionRequestSchema.safeParse({
        ...base,
        action: {
          type: "mark-notification-read",
          notificationId: "training-result:school-user:1:1:2026-04-01",
        },
      }).success,
    ).toBe(true);
    expect(
      gameActionRequestSchema.safeParse({
        ...base,
        action: {
          type: "mark-notification-read",
          notificationId: "training-result:school-user:1:1:2026-04-01",
          readAtGameDate: "2026-04-02",
        },
      }).success,
    ).toBe(false);
  });
});

describe("authoritative official match action", () => {
  it("rejects official-match when no match is due", () => {
    const snapshot = createSnapshot();
    snapshot.state = markWeeklyActionCompleted(snapshot.state, "training");

    expectConflict(
      () => applyGameAction(snapshot, { type: "official-match" }),
      "official_match_not_due",
    );
  });

  it("requires weekly training before a due official match", () => {
    const snapshot = officialWeekSnapshot({ trained: false });

    expectConflict(
      () => applyGameAction(snapshot, { type: "official-match" }),
      "official_match_training_required",
    );
  });

  it("rejects an invalid current lineup before starting the official match", () => {
    const snapshot = officialWeekSnapshot({ trained: true });
    snapshot.teamSelection.rotation[1]!.playerId =
      snapshot.teamSelection.rotation[0]!.playerId;

    expectConflict(
      () => applyGameAction(snapshot, { type: "official-match" }),
      "invalid_team_selection",
    );
  });

  it("derives the same due opponent and first authoritative segment without consuming global RNG", () => {
    const snapshot = officialWeekSnapshot({ trained: true });
    const due = findDueUserOfficialMatch(snapshot.state)!;
    const beforeCursor = snapshot.state.randomCursor;

    const first = applyGameAction(snapshot, { type: "official-match" });
    const second = applyGameAction(snapshot, { type: "official-match" });

    expect(first).toEqual(second);
    expect(first.state.randomCursor).toBe(beforeCursor);
    expect(first.state.activeMatch?.phase).toBe("coach-decision");
    expect(first.outcome).toMatchObject({
      officialMatch: {
        tournamentId: due.stage.tournamentId,
        circuit: due.circuit,
        level: due.level,
        round: due.match.round,
        opponent: {
          entrantId: due.opponent.entrantId,
          displayName: due.opponent.displayName,
        },
      },
      simulation: { analysis: null },
    });
  });

  it("records the authoritative result, advances the bracket, and updates player career stats only after completion", () => {
    const snapshot = officialWeekSnapshot({ trained: true });
    const due = findDueUserOfficialMatch(snapshot.state)!;
    const schoolBefore = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const historyBefore = snapshot.state.history.matches.length;
    const participantIds = new Set([
      ...snapshot.teamSelection.rotation.map(
        (assignment) => assignment.playerId,
      ),
      snapshot.teamSelection.liberoPlayerId!,
    ]);

    const started = applyGameAction(snapshot, { type: "official-match" });
    expect(
      started.state.officialSeason.interhigh.prefectural.matches.find(
        (match) => match.id === due.match.id,
      )?.status,
    ).not.toBe("completed");
    expect(started.state.history.matches).toHaveLength(historyBefore);

    const result = completeOfficialMatch(snapshot);
    const completed =
      result.state.officialSeason.interhigh.prefectural.matches.find(
        (match) => match.id === due.match.id,
      ) ?? null;
    const schoolAfter = result.state.schools[result.state.userSchoolId]!;

    expect(completed?.status).toBe("completed");
    expect(result.state.history.matches).toHaveLength(historyBefore + 1);
    expect(
      schoolAfter.history.officialWins + schoolAfter.history.officialLosses,
    ).toBe(
      schoolBefore.history.officialWins +
        schoolBefore.history.officialLosses +
        1,
    );
    for (const playerId of participantIds) {
      expect(result.state.players[playerId]!.career.appearances).toBe(
        snapshot.state.players[playerId]!.career.appearances + 1,
      );
      expect(
        result.state.players[playerId]!.career.bestTournamentResultId,
      ).not.toBeNull();
    }
    expect(findDueUserOfficialMatch(result.state)).toBeNull();
  });

  it("keeps week progression blocked until the official session completes", () => {
    const snapshot = officialWeekSnapshot({ trained: true });
    const started = applyGameAction(snapshot, { type: "advance-week" });
    expect(started.state.date).toBe(snapshot.state.date);
    expect(started.outcome).toMatchObject({
      weekAdvanced: false,
      pendingMatchPresentation: {
        kind: "official",
        simulation: { analysis: null },
      },
    });

    const reloaded = applyGameAction(
      {
        ...snapshot,
        state: started.state,
        teamSelection: started.teamSelection,
      },
      { type: "advance-week" },
    );
    expect(reloaded.state.date).toBe(snapshot.state.date);
    expect(reloaded.state.activeMatch).toEqual(started.state.activeMatch);
    expect(reloaded.outcome).toMatchObject({
      weekAdvanced: false,
      pendingMatchPresentation: { kind: "official" },
    });

    const completed = completeOfficialMatch(snapshot);
    const advanced = applyGameAction(
      {
        ...snapshot,
        state: completed.state,
        teamSelection: completed.teamSelection,
      },
      { type: "advance-week" },
    );
    expect(advanced.state.date).not.toBe(snapshot.state.date);
    expect(advanced.state.calendar.weekOfYear).toBe(10);
  });
});
