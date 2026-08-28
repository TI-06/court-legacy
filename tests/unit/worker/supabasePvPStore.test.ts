import { describe, expect, it, vi } from "vitest";
import type { Player } from "../../../src/domain/model/Player";
import type { School } from "../../../src/domain/model/School";
import type { TeamSelection } from "../../../src/domain/model/TeamSelection";
import type { PublishedPvpTeamSnapshot } from "../../../worker/data/PvPStore";
import {
  PvPStoreDataError,
  SupabasePvPStore,
} from "../../../worker/data/SupabasePvPStore";
import type { SupabaseAdminClient } from "../../../worker/data/createSupabaseAdmin";

const snapshot: PublishedPvpTeamSnapshot = {
  id: "snapshot-a",
  userId: "00000000-0000-0000-0000-000000000001",
  sourceRevision: 12,
  sourceAcademicYear: 2026,
  sourceYearIndex: 4,
  school: {
    id: "school-a",
    name: "青葉高校",
    shortName: "青葉",
    reputation: "national-qualifier",
  } as School,
  players: {
    "player-a": { id: "player-a" } as Player,
  },
  teamSelection: {
    rotation: [],
    liberoPlayerId: null,
    benchPlayerIds: [],
    servingOrderPlayerIds: [],
    substitutionPolicy: {
      starterLockPlayerIds: [],
      allowFatigueBenching: true,
      allowInjuryBenching: true,
      automaticSubstitutions: true,
      automaticSetChanges: true,
    },
  } as TeamSelection,
  isActive: true,
  publishedAt: "2026-08-28T06:00:00.000Z",
};

function clientWithRpc(rpc: ReturnType<typeof vi.fn>): SupabaseAdminClient {
  return { rpc } as unknown as SupabaseAdminClient;
}

describe("SupabasePvPStore", () => {
  it("publishes an append-only snapshot through the atomic RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: "snapshot-b",
          user_id: snapshot.userId,
          source_revision: 12,
          source_academic_year: 2026,
          source_year_index: 4,
          school: snapshot.school,
          players: snapshot.players,
          team_selection: snapshot.teamSelection,
          is_active: true,
          published_at: "2026-08-28T06:01:00.000Z",
        },
      ],
      error: null,
    });
    const store = new SupabasePvPStore(clientWithRpc(rpc));

    const result = await store.publishSnapshot({
      userId: snapshot.userId,
      operationId: "publish-1",
      sourceRevision: 12,
      sourceAcademicYear: 2026,
      sourceYearIndex: 4,
      school: snapshot.school,
      players: snapshot.players,
      teamSelection: snapshot.teamSelection,
      reputationRank: "B",
      teamPower: 81,
    });

    expect(rpc).toHaveBeenCalledWith("publish_pvp_team_snapshot", {
      p_user_id: snapshot.userId,
      p_operation_id: "publish-1",
      p_source_revision: 12,
      p_source_academic_year: 2026,
      p_source_year_index: 4,
      p_school_name: "青葉高校",
      p_school_short_name: "青葉",
      p_reputation_rank: "B",
      p_team_power: 81,
      p_snapshot: expect.objectContaining({
        school: snapshot.school,
        players: snapshot.players,
        teamSelection: snapshot.teamSelection,
      }),
    });
    expect(result.id).toBe("snapshot-b");
    expect(result.isActive).toBe(true);
  });

  it("maps persisted challenge operations without exposing table details", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          user_id: snapshot.userId,
          operation_id: "challenge-1",
          kind: "challenge",
          response: {
            matchId: "match-1",
            outcome: "win",
          },
        },
      ],
      error: null,
    });
    const store = new SupabasePvPStore(clientWithRpc(rpc));

    await expect(
      store.findChallengeOperation(snapshot.userId, "challenge-1"),
    ).resolves.toEqual({
      userId: snapshot.userId,
      operationId: "challenge-1",
      kind: "challenge",
      response: {
        matchId: "match-1",
        outcome: "win",
      },
    });
    expect(rpc).toHaveBeenCalledWith("find_pvp_operation", {
      p_user_id: snapshot.userId,
      p_operation_id: "challenge-1",
    });
  });

  it("commits a rated match through one atomic RPC and maps final ratings", async () => {
    const defenderUserId = "00000000-0000-0000-0000-000000000002";
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          match_id: "match-1",
          season_id: "2026-08",
          operation_id: "challenge-1",
          challenger_user_id: snapshot.userId,
          defender_user_id: defenderUserId,
          defender_snapshot_id: "snapshot-defender",
          winner_user_id: snapshot.userId,
          challenger_rating_before: 1000,
          challenger_rating_after: 1016,
          defender_rating_before: 1000,
          defender_rating_after: 984,
          result: { homeSetsWon: 2, awaySetsWon: 1 },
          created_at: "2026-08-28T06:10:00.000Z",
        },
      ],
      error: null,
    });
    const store = new SupabasePvPStore(clientWithRpc(rpc));

    const result = await store.commitRatedMatch({
      seasonId: "2026-08",
      challengeDayKey: "2026-08-28",
      operationId: "challenge-1",
      challengerUserId: snapshot.userId,
      defenderUserId,
      defenderSnapshotId: "snapshot-defender",
      challengerSourceRevision: 12,
      matchSeed: "server-seed",
      challengerWon: true,
      result: { homeSetsWon: 2, awaySetsWon: 1 },
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("commit_pvp_rated_match", {
      p_season_id: "2026-08",
      p_challenge_day_key: "2026-08-28",
      p_operation_id: "challenge-1",
      p_challenger_user_id: snapshot.userId,
      p_defender_user_id: defenderUserId,
      p_defender_snapshot_id: "snapshot-defender",
      p_challenger_source_revision: 12,
      p_match_seed: "server-seed",
      p_challenger_won: true,
      p_result: { homeSetsWon: 2, awaySetsWon: 1 },
    });
    expect(result.challengerRatingAfter).toBe(1016);
    expect(result.defenderRatingAfter).toBe(984);
  });

  it("maps sanitized opponent, ranking, and history query DTOs", async () => {
    const rpc = vi.fn().mockImplementation(async (name: string) => {
      if (name === "list_pvp_opponents") {
        return {
          data: [
            {
              snapshot_id: "snapshot-b",
              school_name: "白峰高校",
              school_short_name: "白峰",
              reputation_rank: "A",
              team_power: 88,
              academic_year: 2027,
              published_at: "2026-08-28T05:00:00.000Z",
              rating: 1048,
              wins: 8,
              losses: 3,
              current_win_streak: 2,
            },
          ],
          error: null,
        };
      }
      if (name === "list_pvp_ranking") {
        return {
          data: [
            {
              rank: 1,
              snapshot_id: "snapshot-b",
              school_name: "白峰高校",
              school_short_name: "白峰",
              rating: 1120,
              matches: 20,
              wins: 15,
              losses: 5,
              current_win_streak: 4,
            },
          ],
          error: null,
        };
      }
      return {
        data: [
          {
            match_id: "match-1",
            created_at: "2026-08-28T04:00:00.000Z",
            opponent_snapshot_id: "snapshot-b",
            opponent_school_name: "白峰高校",
            outcome: "win",
            rating_before: 1000,
            rating_after: 1016,
            result: { homeSetsWon: 2, awaySetsWon: 0 },
          },
        ],
        error: null,
      };
    });
    const store = new SupabasePvPStore(clientWithRpc(rpc));

    const opponents = await store.listOpponents({
      userId: snapshot.userId,
      seasonId: "2026-08",
      limit: 20,
      cursor: null,
    });
    const ranking = await store.listRanking({
      seasonId: "2026-08",
      limit: 20,
      cursor: null,
    });
    const history = await store.listHistory({
      userId: snapshot.userId,
      seasonId: "2026-08",
      limit: 20,
      cursor: null,
    });

    expect(opponents[0]).toEqual(
      expect.objectContaining({
        snapshotId: "snapshot-b",
        schoolName: "白峰高校",
        rating: 1048,
      }),
    );
    expect(ranking[0]).toEqual(
      expect.objectContaining({
        rank: 1,
        schoolName: "白峰高校",
        rating: 1120,
      }),
    );
    expect(history[0]).toEqual(
      expect.objectContaining({
        matchId: "match-1",
        opponentSchoolName: "白峰高校",
        outcome: "win",
      }),
    );
    expect(JSON.stringify({ opponents, ranking, history })).not.toContain(
      "abilities",
    );
  });

  it("throws a dedicated data error for invalid database payloads", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ snapshot_id: "snapshot-b", rating: "not-a-number" }],
      error: null,
    });
    const store = new SupabasePvPStore(clientWithRpc(rpc));

    await expect(
      store.listOpponents({
        userId: snapshot.userId,
        seasonId: "2026-08",
        limit: 20,
        cursor: null,
      }),
    ).rejects.toBeInstanceOf(PvPStoreDataError);
  });
});
