import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import type { GameState } from "../../../src/domain/model/GameState";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import {
  advanceOfficialTournamentsThroughWeek,
  completeTournamentMatch,
  findDueUserOfficialMatch,
} from "../../../src/domain/tournament/progressOfficialTournaments";
import type {
  CloudGameSnapshot,
  GameStore,
} from "../../../worker/data/GameStore";
import type {
  PublishPvpSnapshotInput,
  PvPStore,
} from "../../../worker/data/PvPStore";
import { createPvpPublishHandler } from "../../../worker/routes/pvpPublish";

function createState(): GameState {
  return createInitialGame({
    seed: "phase6-pvp-tournament-leakage",
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
}

function atWeek(state: GameState, weekOfYear: number): GameState {
  return {
    ...state,
    calendar: {
      ...state.calendar,
      weekOfYear,
    },
  };
}

function qualifyUserForNationals(state: GameState): GameState {
  let next = state;
  for (const week of [9, 10, 11, 12]) {
    next = advanceOfficialTournamentsThroughWeek(atWeek(next, week));
    const due = findDueUserOfficialMatch(next);
    if (!due) throw new Error(`expected due user match in week ${week}`);
    const userEntrantId = due.userEntrant.entrantId;
    const userIsHome = due.match.homeEntrantId === userEntrantId;
    next = completeTournamentMatch({
      state: next,
      circuit: due.circuit,
      level: due.level,
      matchId: due.match.id,
      winnerEntrantId: userEntrantId,
      homeSetsWon: userIsHome ? 2 : 0,
      awaySetsWon: userIsHome ? 0 : 2,
    });
  }
  return next;
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
        id: "snapshot-phase6",
        userId: input.userId,
        sourceRevision: input.sourceRevision,
        sourceAcademicYear: input.sourceAcademicYear,
        sourceYearIndex: input.sourceYearIndex,
        school: input.school,
        players: input.players,
        teamSelection: input.teamSelection,
        isActive: true,
        publishedAt: "2026-08-29T13:30:00.000Z",
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

describe("PvP tournament leakage regression", () => {
  it("publishes only the frozen team even when authoritative state contains national guest data", async () => {
    const state = qualifyUserForNationals(createState());
    expect(JSON.stringify(state.officialSeason)).toContain("guestSeed");

    const snapshot: CloudGameSnapshot = {
      userId: "00000000-0000-0000-0000-000000000001",
      schoolDbId: "00000000-0000-4000-8000-000000000001",
      revision: 12,
      state,
      teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
    };
    const store = pvpStore();
    const handler = createPvpPublishHandler({
      gameStore: gameStore(snapshot),
      pvpStore: store,
    });

    const response = await handler(
      new Request("https://court-legacy.test/api/pvp/team/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operationId: "phase6-publish", revision: 12 }),
      }),
      { id: snapshot.userId },
    );

    expect(response.status).toBe(200);
    expect(store.published).toHaveLength(1);
    const serializedPublished = JSON.stringify(store.published[0]);
    expect(serializedPublished).not.toContain("officialSeason");
    expect(serializedPublished).not.toContain("officialTournaments");
    expect(serializedPublished).not.toContain("guestSeed");
    expect(serializedPublished).not.toContain("shopEffects");
  });
});
