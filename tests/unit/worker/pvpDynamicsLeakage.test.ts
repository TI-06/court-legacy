import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import type { GameState } from "../../../src/domain/model/GameState";
import type { Player } from "../../../src/domain/model/Player";
import type { TeamSelection } from "../../../src/domain/model/TeamSelection";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type {
  CloudGameSnapshot,
  GameStore,
} from "../../../worker/data/GameStore";
import type {
  PublishedPvpTeamSnapshot,
  PublishPvpSnapshotInput,
  PvPStore,
} from "../../../worker/data/PvPStore";
import { simulatePvpMatch } from "../../../worker/pvp/simulatePvpMatch";
import { createPvpPublishHandler } from "../../../worker/routes/pvpPublish";

function selectionFor(state: GameState): TeamSelection {
  return autoSelectTeam({ state, schoolId: state.userSchoolId });
}

function cloudSnapshot(
  userId: string,
  state: GameState,
  revision = 1,
): CloudGameSnapshot {
  return {
    userId,
    schoolDbId: `${userId}-school`,
    revision,
    state,
    teamSelection: selectionFor(state),
  };
}

function defenderSnapshot(state: GameState): PublishedPvpTeamSnapshot {
  const school = structuredClone(state.schools[state.userSchoolId]!);
  const players = Object.fromEntries(
    school.playerIds.map((id) => [id, structuredClone(state.players[id]!)]),
  ) as Record<string, Player>;

  return {
    id: "snapshot-defender-dynamics",
    userId: "defender-user",
    sourceRevision: 1,
    sourceAcademicYear: state.calendar.academicYear,
    sourceYearIndex: state.yearIndex,
    school,
    players,
    teamSelection: selectionFor(state),
    isActive: true,
    publishedAt: "2026-08-30T00:00:00.000Z",
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

function pvpStore(): PvPStore & { published: PublishPvpSnapshotInput[] } {
  const store: PvPStore & { published: PublishPvpSnapshotInput[] } = {
    published: [],
    publishSnapshot: vi.fn(async (input) => {
      store.published.push(input);
      return {
        id: "snapshot-phase7",
        userId: input.userId,
        sourceRevision: input.sourceRevision,
        sourceAcademicYear: input.sourceAcademicYear,
        sourceYearIndex: input.sourceYearIndex,
        school: input.school,
        players: input.players,
        teamSelection: input.teamSelection,
        isActive: true,
        publishedAt: "2026-08-30T00:00:00.000Z",
      };
    }),
    findChallengeOperation: vi.fn(async () => null),
    getSnapshotById: vi.fn(async () => null),
    commitRatedMatch: vi.fn(async () => {
      throw new Error("not used");
    }),
    listOpponents: vi.fn(async () => []),
    listRanking: vi.fn(async () => []),
    listHistory: vi.fn(async () => []),
  };
  return store;
}

function assertNoDynamicsPayload(value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("teamDynamics");
  expect(serialized).not.toContain("cohesion");
  expect(serialized).not.toContain("playerConcerns");
  expect(serialized).not.toContain("playerRelationships");
  expect(serialized).not.toContain("recentOfficialStarterCounts");
}

describe("ranked PvP dynamics isolation", () => {
  it("projects frozen and public PvP payloads without team dynamics state", async () => {
    const state = createDemoGame();
    const firstPlayerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.teamDynamics = {
      ...state.teamDynamics,
      cohesion: 3,
      previousCohesion: 97,
      playerConcerns: {
        [firstPlayerId]: [
          {
            code: "playing-time",
            severity: 100,
            message: "must-not-leak",
          },
        ],
      },
      recentOfficialStarterCounts: { [firstPlayerId]: 8 },
      recentOfficialMatchesTracked: 8,
    };
    state.playerRelationships = {
      [`${firstPlayerId}::sentinel-player`]: 1,
    };
    const snapshot = cloudSnapshot("phase7-publish-user", state, 7);
    const store = pvpStore();
    const handler = createPvpPublishHandler({
      gameStore: gameStore(snapshot),
      pvpStore: store,
    });

    const response = await handler(
      new Request("https://court-legacy.test/api/pvp/team/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operationId: "phase7-publish", revision: 7 }),
      }),
      { id: snapshot.userId },
    );

    expect(response.status).toBe(200);
    expect(store.published).toHaveLength(1);
    assertNoDynamicsPayload(store.published[0]);
    assertNoDynamicsPayload(await response.json());
  });

  it("produces the same ranked result for cohesion 0 and 100 with the same seed", () => {
    const lowDynamicsState = createDemoGame();
    const highDynamicsState = structuredClone(lowDynamicsState) as GameState;
    const firstPlayerId =
      lowDynamicsState.schools[lowDynamicsState.userSchoolId]!.playerIds[0]!;

    lowDynamicsState.teamDynamics = {
      ...lowDynamicsState.teamDynamics,
      cohesion: 0,
      previousCohesion: 0,
      playerConcerns: {
        [firstPlayerId]: [
          {
            code: "team-slump",
            severity: 100,
            message: "low-dynamics",
          },
        ],
      },
    };
    highDynamicsState.teamDynamics = {
      ...highDynamicsState.teamDynamics,
      cohesion: 100,
      previousCohesion: 100,
      playerConcerns: {},
    };
    lowDynamicsState.playerRelationships = Object.fromEntries(
      Object.keys(lowDynamicsState.playerRelationships).map((key) => [key, 0]),
    );
    highDynamicsState.playerRelationships = Object.fromEntries(
      Object.keys(highDynamicsState.playerRelationships).map((key) => [key, 100]),
    );

    const defenderState = createDemoGame();
    const defender = defenderSnapshot(defenderState);
    const lowResult = simulatePvpMatch({
      challenger: cloudSnapshot("challenger-user", lowDynamicsState),
      defender,
      matchSeed: "phase7-ranked-dynamics-isolation",
    });
    const highResult = simulatePvpMatch({
      challenger: cloudSnapshot("challenger-user", highDynamicsState),
      defender,
      matchSeed: "phase7-ranked-dynamics-isolation",
    });

    expect(lowResult).toEqual(highResult);
  });
});
