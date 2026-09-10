import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type {
  CloudGameSnapshot,
  GameStore,
} from "../../../worker/data/GameStore";
import type {
  CommitRatedPvpMatchInput,
  CommittedRatedPvpMatch,
  PersistedPvpMatchSession,
  PublishedPvpTeamSnapshot,
  PvpMatchSessionStore,
} from "../../../worker/data/PvPStore";
import {
  startPvpMatchSession,
  type PvpMatchSessionStep,
} from "../../../worker/pvp/pvpMatchSession";
import { createPvpChallengeCommandHandler } from "../../../worker/routes/pvpChallengeCommand";

const challengerUserId = "00000000-0000-0000-0000-000000000301";
const defenderUserId = "00000000-0000-0000-0000-000000000302";
const defenderSnapshotId = "00000000-0000-4000-8000-000000000303";
const operationId = "phase16-command-resume-operation";

function challengerSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase16-command-resume-challenger",
    schoolName: "蒼空高校",
    schoolShortName: "蒼空",
    coachName: "佐藤 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
  return {
    userId: challengerUserId,
    schoolDbId: "00000000-0000-4000-8000-000000000304",
    revision: 18,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function defenderSnapshot(): PublishedPvpTeamSnapshot {
  const state = createInitialGame({
    seed: "phase16-command-resume-defender",
    schoolName: "紅葉高校",
    schoolShortName: "紅葉",
    coachName: "鈴木 監督",
    regionId: "region.kanagawa",
    uniform: {
      primary: "#663344",
      secondary: "#FFFFFF",
      accent: "#CCAA55",
    },
  });
  const school = state.schools[state.userSchoolId]!;
  return {
    id: defenderSnapshotId,
    userId: defenderUserId,
    sourceRevision: 9,
    sourceAcademicYear: state.calendar.academicYear,
    sourceYearIndex: state.yearIndex,
    school: structuredClone(school),
    players: Object.fromEntries(
      school.playerIds.map((id) => [id, structuredClone(state.players[id]!)]),
    ),
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
    isActive: true,
    publishedAt: "2026-09-10T10:00:00.000Z",
  };
}

function startAtOpponentRun(): PvpMatchSessionStep {
  const challenger = challengerSnapshot();
  const defender = defenderSnapshot();
  for (let index = 0; index < 40; index += 1) {
    const started = startPvpMatchSession({
      operationId,
      challenger,
      defender,
      challengerSourceRevision: challenger.revision,
      seasonId: "2026-09",
      challengeDayKey: "2026-09-11",
      matchSeed: `phase16-command-resume-seed-${index}`,
    });
    if (started.segment.pendingDecisionReason === "opponent-run") {
      return started;
    }
  }
  throw new Error("could not find deterministic opponent-run fixture");
}

function completedMatchStub(
  input: CommitRatedPvpMatchInput,
): CommittedRatedPvpMatch {
  return {
    matchId: "00000000-0000-4000-8000-000000000305",
    seasonId: input.seasonId,
    operationId: input.operationId,
    challengerUserId: input.challengerUserId,
    defenderUserId: input.defenderUserId,
    defenderSnapshotId: input.defenderSnapshotId,
    winnerUserId: input.challengerUserId,
    challengerRatingBefore: 1000,
    challengerRatingAfter: 1016,
    defenderRatingBefore: 1000,
    defenderRatingAfter: 984,
    result: input.result,
    createdAt: "2026-09-10T10:30:00.000Z",
  };
}

function gameStore(snapshot: CloudGameSnapshot): GameStore {
  return {
    getSnapshot: vi.fn(async () => snapshot),
    getOperationResponse: vi.fn(async () => null),
    createGame: vi.fn(async () => {
      throw new Error("not used");
    }),
    applyOperation: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

function storeForSession(
  persisted: PersistedPvpMatchSession,
  defender: PublishedPvpTeamSnapshot,
): PvpMatchSessionStore {
  const store: PvpMatchSessionStore = {
    publishSnapshot: vi.fn(async () => defender),
    findChallengeOperation: vi.fn(async () => null),
    getSnapshotById: vi.fn(async () => defender),
    commitRatedMatch: vi.fn(async (input) => completedMatchStub(input)),
    listOpponents: vi.fn(async () => []),
    listRanking: vi.fn(async () => []),
    listHistory: vi.fn(async () => []),
    createMatchSession: vi.fn(async () => persisted),
    getMatchSession: vi.fn(async () => persisted),
    getMatchSessionCommandReceipt: vi.fn(async () => null),
    saveMatchSessionCommand: vi.fn(async (input) => ({
      session: {
        ...persisted,
        currentCursor: input.nextCursor,
        privateSession: input.privateSession,
        publicResponse: input.publicResponse,
      },
      replayed: false,
      commandResponse: input.publicResponse,
    })),
    storeMatchSessionFinalResponse: vi.fn(async () => persisted),
  };
  return store;
}

describe("Phase 16 PvP command resume route", () => {
  it("resumes one private session from its authoritative cursor and CAS-saves the next public segment", async () => {
    const challenger = challengerSnapshot();
    const defender = defenderSnapshot();
    const started = startAtOpponentRun();
    expect(started.session.match.phase).toBe("coach-decision");
    expect(started.segment.pendingDecisionReason).toBe("opponent-run");

    const publicResponse = {
      status: "in-progress" as const,
      operationId,
      revision: challenger.revision,
      seasonId: "2026-09",
      opponent: {
        snapshotId: defender.id,
        schoolName: defender.school.name,
        schoolShortName: defender.school.shortName,
      },
      segment: started.segment,
    };
    const persisted: PersistedPvpMatchSession = {
      challengerUserId,
      operationId,
      defenderSnapshotId: defender.id,
      challengerSourceRevision: challenger.revision,
      currentCursor: started.session.match.randomCursor,
      privateSession: started.session,
      publicResponse,
      finalResponse: null,
      createdAt: "2026-09-10T10:20:00.000Z",
      updatedAt: "2026-09-10T10:20:00.000Z",
    };
    const store = storeForSession(persisted, defender);
    const handler = createPvpChallengeCommandHandler({ pvpStore: store });

    const response = await handler(
      new Request("https://court-legacy.test/api/pvp/challenge/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId,
          commandId: "command-resume-001",
          command: { type: "continue" },
        }),
      }),
      { id: challengerUserId },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "in-progress",
      operationId,
      revision: challenger.revision,
      seasonId: "2026-09",
      segment: {
        status: "in-progress",
        operationId,
        phase: "coach-decision",
      },
    });
    expect(store.getMatchSessionCommandReceipt).toHaveBeenCalledTimes(1);
    expect(store.getMatchSession).toHaveBeenCalledWith(
      challengerUserId,
      operationId,
    );
    expect(store.saveMatchSessionCommand).toHaveBeenCalledTimes(1);
    const saveInput = vi.mocked(store.saveMatchSessionCommand).mock
      .calls[0]![0];
    expect(saveInput.command).toEqual({ type: "continue" });
    expect(saveInput.expectedCursor).toBe(persisted.currentCursor);
    expect(saveInput.nextCursor).toBeGreaterThan(persisted.currentCursor);
    expect(saveInput.privateSession).not.toBe(persisted.privateSession);
    expect(store.commitRatedMatch).not.toHaveBeenCalled();

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("simulationState");
    expect(serialized).not.toContain("runtime");
    expect(serialized).not.toContain("abilities");
  });
});
