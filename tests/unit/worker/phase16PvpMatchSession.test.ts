import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import type { Player } from "../../../src/domain/model/Player";
import type { MatchCommand } from "../../../src/domain/model/Match";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import type { PublishedPvpTeamSnapshot } from "../../../worker/data/PvPStore";
import { chooseAutomaticDefenderCommand } from "../../../worker/pvp/automaticDefenderCoach";
import {
  resumePvpMatchSession,
  startPvpMatchSession,
} from "../../../worker/pvp/pvpMatchSession";

function challengerSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: "phase16-challenger-user",
    schoolDbId: "00000000-0000-4000-8000-000000000161",
    revision: 8,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function defenderSnapshot(): PublishedPvpTeamSnapshot {
  const state = createDemoGame();
  const school = structuredClone(state.schools[state.userSchoolId]!);
  school.coach = {
    ...school.coach,
    leadership: 95,
    tactics: 95,
  };
  const players = Object.fromEntries(
    school.playerIds.map((id) => [id, structuredClone(state.players[id]!)]),
  ) as Record<string, Player>;

  return {
    id: "phase16-defender-snapshot",
    userId: "phase16-defender-user",
    sourceRevision: 8,
    sourceAcademicYear: state.calendar.academicYear,
    sourceYearIndex: state.yearIndex,
    school,
    players,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
    isActive: true,
    publishedAt: "2026-09-10T09:00:00.000Z",
  };
}

function startFixture() {
  return startPvpMatchSession({
    operationId: "phase16-pvp-operation",
    challenger: challengerSnapshot(),
    defender: defenderSnapshot(),
    challengerSourceRevision: 8,
    seasonId: "2026-09",
    challengeDayKey: "2026-09-10",
    matchSeed: "phase16-pvp-resumable-seed",
  });
}

function continueCommand(): MatchCommand {
  return { type: "continue" };
}

describe("Phase 16 private resumable PvP match session", () => {
  it("stops at challenger decisions and resumes deterministically without precomputing the rest of the match", () => {
    const first = startFixture();
    const replay = startFixture();

    expect(first).toEqual(replay);
    expect(first.session.match.phase).toBe("coach-decision");
    expect(first.session.match.pendingCoachCommandForSchoolId).toBe(
      first.session.challengerSchoolId,
    );
    expect(first.segment.status).toBe("in-progress");
    expect(first.segment.phase).toBe("coach-decision");
    expect(first.session.finalized).toBe(false);
    expect(
      first.session.match.eventLog.some((event) => event.type === "match-end"),
    ).toBe(false);

    const beforeEvents = structuredClone(first.session.match.eventLog);
    const resumed = resumePvpMatchSession({
      session: first.session,
      command: continueCommand(),
    });

    expect(
      resumed.session.match.eventLog.slice(0, beforeEvents.length),
    ).toEqual(beforeEvents);
    expect(resumed.session.match.eventLog.length).toBeGreaterThan(
      beforeEvents.length,
    );
    expect(["coach-decision", "match-complete"]).toContain(
      resumed.session.match.phase,
    );
  });

  it("keeps defender coaching deterministic and consumes no additional randomness", () => {
    const started = startFixture();
    const defender =
      started.session.simulationState.schools[
        started.session.defenderSchoolId
      ]!;
    const cursorBefore = started.session.match.randomCursor;

    const first = chooseAutomaticDefenderCommand({
      school: defender,
      reason: "opponent-run",
      timeoutAlreadyUsed: false,
    });
    const second = chooseAutomaticDefenderCommand({
      school: defender,
      reason: "opponent-run",
      timeoutAlreadyUsed: false,
    });

    expect(first).toEqual(second);
    expect(first).toEqual({ type: "timeout" });
    expect(
      chooseAutomaticDefenderCommand({
        school: defender,
        reason: "set-break",
        timeoutAlreadyUsed: false,
      }),
    ).toEqual({ type: "continue" });
    expect(started.session.match.randomCursor).toBe(cursorBefore);
  });

  it("sanitizes public segments while exposing only challenger-owned command state", () => {
    const started = startFixture();
    const runtime = started.session.match.runtime;
    if (!runtime) throw new Error("PvP runtime missing from fixture");
    const serialized = JSON.stringify(started.segment);

    expect(started.segment.challengerSelection).toEqual(
      started.session.match.homeSelection,
    );
    expect(started.segment.challengerTactics).toEqual(runtime.homeTactics);
    expect(started.segment.timeoutAvailable).toBe(
      runtime.pendingDecisionReason === "opponent-run" &&
        !runtime.timeoutUsedSchoolIds.includes(
          started.session.challengerSchoolId,
        ),
    );

    for (const forbidden of [
      "abilities",
      "potential",
      "hiddenTraitIds",
      "runtime",
      "homeSelection",
      "awaySelection",
      "actorPlayerId",
      "targetPlayerId",
      "serveTargetPlayerId",
      "defender:",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    const defenderPlayerIds =
      started.session.simulationState.schools[started.session.defenderSchoolId]!
        .playerIds;
    for (const defenderPlayerId of defenderPlayerIds) {
      expect(serialized).not.toContain(defenderPlayerId);
    }

    expect(started.segment.events.length).toBeGreaterThan(0);
    expect(started.segment.pendingDecisionReason).toMatch(
      /^(opponent-run|set-break)$/,
    );
  });
});
