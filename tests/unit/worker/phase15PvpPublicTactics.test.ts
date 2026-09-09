import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { applyMatchTacticPlan } from "../../../src/domain/team/matchTactics";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type {
  CloudGameSnapshot,
  GameStore,
} from "../../../worker/data/GameStore";
import type {
  PublishPvpSnapshotInput,
  PvPStore,
} from "../../../worker/data/PvPStore";
import { createPvpPublishHandler } from "../../../worker/routes/pvpPublish";

const publicPlan = {
  serve: "aggressive",
  attack: "quick",
  block: "commit",
} as const;

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase15-pvp-public-tactics",
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
  school.tactics = applyMatchTacticPlan(school.tactics, publicPlan);
  school.tactics.serveTargetPlayerId = school.playerIds[0]!;

  return {
    userId: "00000000-0000-0000-0000-000000000001",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision: 15,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
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
        id: "phase15-snapshot",
        userId: input.userId,
        sourceRevision: input.sourceRevision,
        sourceAcademicYear: input.sourceAcademicYear,
        sourceYearIndex: input.sourceYearIndex,
        school: input.school,
        players: input.players,
        teamSelection: input.teamSelection,
        isActive: true,
        publishedAt: "2026-09-09T10:00:00.000Z",
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

function request(): Request {
  return new Request("https://court-legacy.test/api/pvp/team/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operationId: "phase15-publish", revision: 15 }),
  });
}

describe("Phase 15 PvP public tactics", () => {
  it("freezes and returns only the categorical public tactic summary", async () => {
    const snapshot = createSnapshot();
    const store = pvpStore();
    const handler = createPvpPublishHandler({
      gameStore: gameStore(snapshot),
      pvpStore: store,
    });

    const response = await handler(request(), { id: snapshot.userId });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.team.tactics).toEqual(publicPlan);
    const frozenSchool = store.published[0]!.school as typeof store.published[0]["school"] & {
      phase15PublicTactics?: unknown;
    };
    expect(frozenSchool.phase15PublicTactics).toEqual(publicPlan);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("serveTargetPlayerId");
    expect(serialized).not.toContain(
      snapshot.state.schools[snapshot.state.userSchoolId]!.playerIds[0],
    );
    expect(serialized).not.toContain("abilities");
  });
});
