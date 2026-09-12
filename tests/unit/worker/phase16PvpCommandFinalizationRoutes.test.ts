import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import type {
  CommitRatedPvpMatchInput,
  CommittedRatedPvpMatch,
  PersistedPvpMatchSession,
  PublishedPvpTeamSnapshot,
  PvpMatchSessionStore,
} from "../../../worker/data/PvPStore";
import {
  resumePvpMatchSession,
  startPvpMatchSession,
  type PvpMatchSessionStep,
} from "../../../worker/pvp/pvpMatchSession";
import { createPvpChallengeCommandHandler } from "../../../worker/routes/pvpChallengeCommand";

const challengerUserId = "00000000-0000-0000-0000-000000000401";
const defenderUserId = "00000000-0000-0000-0000-000000000402";
const defenderSnapshotId = "00000000-0000-4000-8000-000000000403";
const operationId = "phase16-command-finalize-operation";

function challengerSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase16-command-finalize-challenger",
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
    schoolDbId: "00000000-0000-4000-8000-000000000404",
    revision: 21,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function defenderSnapshot(): PublishedPvpTeamSnapshot {
  const state = createInitialGame({
    seed: "phase16-command-finalize-defender",
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
    sourceRevision: 11,
    sourceAcademicYear: state.calendar.academicYear,
    sourceYearIndex: state.yearIndex,
    school: structuredClone(school),
    players: Object.fromEntries(
      school.playerIds.map((id) => [id, structuredClone(state.players[id]!)]),
    ),
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
    isActive: true,
    publishedAt: "2026-09-11T05:00:00.000Z",
  };
}

function finalDecision(): PvpMatchSessionStep {
  const challenger = challengerSnapshot();
  const defender = defenderSnapshot();
  let current = startPvpMatchSession({
    operationId,
    challenger,
    defender,
    challengerSourceRevision: challenger.revision,
    seasonId: "2026-09",
    challengeDayKey: "2026-09-11",
    matchSeed: "phase16-command-finalize-seed",
  });

  for (let index = 0; index < 40; index += 1) {
    const next = resumePvpMatchSession({
      session: current.session,
      command: { type: "continue" },
    });
    if (next.segment.status === "complete") {
      return current;
    }
    current = next;
  }
  throw new Error("could not find final PvP coach decision");
}

function persistedFrom(step: PvpMatchSessionStep): PersistedPvpMatchSession {
  const defender =
    step.session.simulationState.schools[step.session.defenderSchoolId]!;
  return {
    challengerUserId,
    operationId,
    defenderSnapshotId,
    challengerSourceRevision: step.session.challengerSourceRevision,
    currentCursor: step.session.match.randomCursor,
    privateSession: step.session,
    publicResponse: {
      status: "in-progress",
      operationId,
      revision: step.session.challengerSourceRevision,
      seasonId: step.session.seasonId,
      opponent: {
        snapshotId: defenderSnapshotId,
        schoolName: defender.name,
        schoolShortName: defender.shortName,
      },
      segment: step.segment,
    },
    finalResponse: null,
    createdAt: "2026-09-11T05:10:00.000Z",
    updatedAt: "2026-09-11T05:10:00.000Z",
  };
}

function committedMatch(
  input: CommitRatedPvpMatchInput,
): CommittedRatedPvpMatch {
  return {
    matchId: "00000000-0000-4000-8000-000000000405",
    seasonId: input.seasonId,
    operationId: input.operationId,
    challengerUserId: input.challengerUserId,
    defenderUserId: input.defenderUserId,
    defenderSnapshotId: input.defenderSnapshotId,
    winnerUserId: input.challengerWon
      ? input.challengerUserId
      : input.defenderUserId,
    challengerRatingBefore: 1000,
    challengerRatingAfter: input.challengerWon ? 1016 : 984,
    defenderRatingBefore: 1000,
    defenderRatingAfter: input.challengerWon ? 984 : 1016,
    result: input.result,
    createdAt: "2026-09-11T05:20:00.000Z",
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
    commitRatedMatch: vi.fn(async (input) => committedMatch(input)),
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
    storeMatchSessionFinalResponse: vi.fn(async (input) => ({
      ...persisted,
      publicResponse: input.finalResponse,
      finalResponse: input.finalResponse,
    })),
  };
  return store;
}

function commandRequest(commandId = "command-finalize-001"): Request {
  return new Request("https://court-legacy.test/api/pvp/challenge/command", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operationId,
      commandId,
      command: { type: "continue" },
    }),
  });
}

describe("Phase 16 PvP command finalization", () => {
  it("commits rating once from the completed authoritative match, CAS-saves the command, and persists the canonical final response", async () => {
    const beforeFinal = finalDecision();
    const persisted = persistedFrom(beforeFinal);
    const defender = defenderSnapshot();
    const store = storeForSession(persisted, defender);
    const handler = createPvpChallengeCommandHandler({ pvpStore: store });

    const response = await handler(commandRequest(), { id: challengerUserId });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(store.commitRatedMatch).toHaveBeenCalledTimes(1);
    const commitInput = vi.mocked(store.commitRatedMatch).mock.calls[0]![0];
    expect(commitInput).toMatchObject({
      seasonId: "2026-09",
      challengeDayKey: "2026-09-11",
      operationId,
      challengerUserId,
      defenderUserId,
      defenderSnapshotId,
      challengerSourceRevision: persisted.challengerSourceRevision,
      matchSeed: "phase16-command-finalize-seed",
      challengerWon: expect.any(Boolean),
      result: {
        outcome: expect.stringMatching(/^(win|loss)$/),
        challengerSetsWon: expect.any(Number),
        defenderSetsWon: expect.any(Number),
        sets: expect.any(Array),
        challengerSchoolName: "蒼空高校",
      },
    });

    expect(store.saveMatchSessionCommand).toHaveBeenCalledTimes(1);
    const saveInput = vi.mocked(store.saveMatchSessionCommand).mock
      .calls[0]![0];
    expect(saveInput.expectedCursor).toBe(persisted.currentCursor);
    expect(saveInput.nextCursor).toBeGreaterThanOrEqual(
      persisted.currentCursor,
    );
    expect(saveInput.privateSession).toMatchObject({ finalized: true });
    expect(saveInput.publicResponse).toEqual(body);

    expect(store.storeMatchSessionFinalResponse).toHaveBeenCalledTimes(1);
    expect(store.storeMatchSessionFinalResponse).toHaveBeenCalledWith({
      challengerUserId,
      operationId,
      finalResponse: body,
    });

    expect(body).toMatchObject({
      operationId,
      revision: persisted.challengerSourceRevision,
      seasonId: "2026-09",
      matchId: "00000000-0000-4000-8000-000000000405",
      opponent: {
        snapshotId: defenderSnapshotId,
        schoolName: "紅葉高校",
        schoolShortName: "紅葉",
      },
      rating: {
        before: 1000,
        after: expect.any(Number),
        delta: expect.any(Number),
      },
      result: {
        outcome: expect.stringMatching(/^(win|loss)$/),
        challengerSetsWon: expect.any(Number),
        defenderSetsWon: expect.any(Number),
        sets: expect.any(Array),
      },
      createdAt: "2026-09-11T05:20:00.000Z",
    });
    expect(body).not.toHaveProperty("status");
    const serialized = JSON.stringify(body);
    for (const forbidden of [
      "simulationState",
      "runtime",
      "abilities",
      "hiddenTraitIds",
      "homeSelection",
      "awaySelection",
      "challengerSchoolName",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("recovers a saved completion receipt by persisting its final response without recommitting rating", async () => {
    const beforeFinal = finalDecision();
    const persisted = persistedFrom(beforeFinal);
    const defender = defenderSnapshot();
    const store = storeForSession(persisted, defender);
    const finalResponse = {
      operationId,
      revision: persisted.challengerSourceRevision,
      seasonId: "2026-09",
      matchId: "00000000-0000-4000-8000-000000000405",
      opponent: {
        snapshotId: defenderSnapshotId,
        schoolName: "紅葉高校",
        schoolShortName: "紅葉",
      },
      rating: { before: 1000, after: 1016, delta: 16 },
      result: {
        outcome: "win",
        challengerSetsWon: 2,
        defenderSetsWon: 1,
        sets: [
          { setNumber: 1, challengerScore: 25, defenderScore: 20 },
          { setNumber: 2, challengerScore: 22, defenderScore: 25 },
          { setNumber: 3, challengerScore: 15, defenderScore: 12 },
        ],
      },
      createdAt: "2026-09-11T05:20:00.000Z",
    };
    vi.mocked(store.getMatchSessionCommandReceipt).mockResolvedValue({
      commandId: "command-finalize-001",
      command: { type: "continue" },
      publicResponse: finalResponse,
    });
    const handler = createPvpChallengeCommandHandler({ pvpStore: store });

    const response = await handler(commandRequest(), { id: challengerUserId });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(finalResponse);
    expect(store.commitRatedMatch).not.toHaveBeenCalled();
    expect(store.getMatchSession).not.toHaveBeenCalled();
    expect(store.storeMatchSessionFinalResponse).toHaveBeenCalledWith({
      challengerUserId,
      operationId,
      finalResponse,
    });
  });
});
