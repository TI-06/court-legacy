import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import type {
  AdvanceWeekOutcome,
  PendingMatchPresentation,
} from "../../../src/domain/calendar/advanceWeekOutcome";
import { activeInvitationalCup } from "../../../src/domain/school/invitationalCup";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { applyServerGameAction } from "../../../worker/game/applyServerGameAction";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase51-invitational-worker",
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
  const school = state.schools[state.userSchoolId]!;
  school.funds = 5000;
  school.reputationPoints = 900;
  school.reputation = "elite";
  school.history.nationalTitles = 1;
  school.facilities.gym = 50;
  school.facilities.analysisRoom = 50;

  return {
    userId: "phase51-invitational-user",
    schoolDbId: "00000000-0000-4000-8000-000000005104",
    revision: 51,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function continueSnapshot(
  previous: CloudGameSnapshot,
  result: ReturnType<typeof applyServerGameAction>,
): CloudGameSnapshot {
  return {
    ...previous,
    revision: previous.revision + 1,
    state: result.state,
    teamSelection: result.teamSelection,
  };
}

describe("Phase51 invitational cup worker flow", () => {
  it("purchases a bounded four-school cup and starts its semifinal authoritatively", () => {
    const snapshot = createSnapshot();

    const purchased = applyServerGameAction(snapshot, {
      type: "school-special-project",
      projectId: "invitational-cup",
    });
    expect(purchased.state.schools[purchased.state.userSchoolId]!.funds).toBe(
      3200,
    );
    expect(activeInvitationalCup(purchased.state)).toMatchObject({
      currentRound: "semifinal",
      championSchoolId: null,
      userEliminated: false,
    });

    const started = applyServerGameAction(
      continueSnapshot(snapshot, purchased),
      { type: "advance-week" },
    );
    const outcome = started.outcome as AdvanceWeekOutcome;

    expect(outcome.weekAdvanced).toBe(false);
    expect(outcome.pendingMatchPresentation?.kind).toBe("invitational");
    expect(outcome.pendingMatchPresentation?.simulation.analysis).toBeNull();
    expect(started.state.activeMatch?.runtime?.controlledSchoolId).toBe(
      started.state.userSchoolId,
    );
  });

  it("routes a Phase52 serve target through the invitational command path", () => {
    const snapshot = createSnapshot();
    const purchased = applyServerGameAction(snapshot, {
      type: "school-special-project",
      projectId: "invitational-cup",
    });
    let currentSnapshot = continueSnapshot(snapshot, purchased);
    let current = applyServerGameAction(currentSnapshot, {
      type: "advance-week",
    });
    currentSnapshot = continueSnapshot(currentSnapshot, current);

    for (let guard = 0; guard < 6; guard += 1) {
      const active = current.state.activeMatch;
      if (!active?.runtime) throw new Error("invitational runtime missing");
      if (active.runtime.pendingDecisionReason !== "set-break") break;

      current = applyServerGameAction(currentSnapshot, {
        type: "match-command",
        command: { type: "continue" },
      });
      currentSnapshot = continueSnapshot(currentSnapshot, current);
    }

    const active = current.state.activeMatch;
    if (!active?.runtime) throw new Error("invitational active match missing");
    expect(active.runtime.pendingDecisionReason).not.toBe("set-break");

    const opponentSelection =
      active.homeSchoolId === current.state.userSchoolId
        ? active.awaySelection
        : active.homeSelection;
    const targetPlayerId =
      opponentSelection.liberoPlayerId ??
      opponentSelection.rotation[0]!.playerId;
    const persistentTarget =
      current.state.schools[current.state.userSchoolId]!.tactics
        .serveTargetPlayerId;

    const targeted = applyServerGameAction(currentSnapshot, {
      type: "match-command",
      command: { type: "target-serve-receiver", playerId: targetPlayerId },
    });

    expect(
      targeted.state.activeMatch?.runtime?.commandHistory.some(
        (record) =>
          record.command.type === "target-serve-receiver" &&
          record.command.playerId === targetPlayerId,
      ),
    ).toBe(true);
    expect(
      targeted.state.schools[targeted.state.userSchoolId]!.tactics
        .serveTargetPlayerId,
    ).toBe(persistentTarget);
  });

  it("completes the invitational through the canonical match command result path", () => {
    const snapshot = createSnapshot();
    const purchased = applyServerGameAction(snapshot, {
      type: "school-special-project",
      projectId: "invitational-cup",
    });
    const purchasedSnapshot = continueSnapshot(snapshot, purchased);
    const started = applyServerGameAction(purchasedSnapshot, {
      type: "advance-week",
    });
    const startedMatch = started.state.activeMatch;
    if (!startedMatch) throw new Error("invitational match missing");

    const skipped = applyServerGameAction(
      continueSnapshot(purchasedSnapshot, started),
      { type: "match-command", command: { type: "skip-to-result" } },
    );
    const presentation = skipped.outcome as PendingMatchPresentation;

    expect(presentation.kind).toBe("invitational");
    expect(presentation.simulation.analysis).not.toBeNull();
    expect(presentation.simulation.match.id).toBe(startedMatch.id);
    expect(presentation.simulation.match.phase).toBe("match-complete");
    expect(skipped.state.activeMatch?.id).toBe(startedMatch.id);
    expect(skipped.state.activeMatch?.phase).toBe("match-complete");
  });

  it("re-opens the same invitational match after a reload-style advance retry", () => {
    const snapshot = createSnapshot();
    const purchased = applyServerGameAction(snapshot, {
      type: "school-special-project",
      projectId: "invitational-cup",
    });
    const purchasedSnapshot = continueSnapshot(snapshot, purchased);
    const started = applyServerGameAction(purchasedSnapshot, {
      type: "advance-week",
    });
    const startedMatch = started.state.activeMatch;
    if (!startedMatch) throw new Error("invitational match missing");

    const resumed = applyServerGameAction(
      continueSnapshot(purchasedSnapshot, started),
      { type: "advance-week" },
    );
    const outcome = resumed.outcome as AdvanceWeekOutcome;

    expect(outcome.pendingMatchPresentation?.kind).toBe("invitational");
    expect(resumed.state.activeMatch?.id).toBe(startedMatch.id);
    expect(resumed.state.activeMatch?.phase).toBe(startedMatch.phase);
  });
});
