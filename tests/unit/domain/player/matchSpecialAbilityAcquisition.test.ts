import { createDemoGame } from "../../../../src/app/createDemoGame";
import type {
  UserMatchPerformanceSnapshot,
  UserMatchPlayerPerformance,
} from "../../../../src/domain/match/userMatchPerformance";
import { matchId } from "../../../../src/domain/model/identifiers";
import {
  applyMatchNormalAbilityAcquisition,
  MATCH_NORMAL_ABILITY_IDS,
} from "../../../../src/domain/player/matchSpecialAbilityAcquisition";
import { getSpecialAbilityDefinition } from "../../../../src/domain/player/specialAbilities";
import type { RandomSource } from "../../../../src/domain/random/SeededRandom";

function fixedRollRandom(roll: number): RandomSource {
  let cursor = 0;
  return {
    get cursor() {
      return cursor;
    },
    next() {
      cursor += 1;
      return (roll - 1) / 100;
    },
    int(minimum, maximum) {
      cursor += 1;
      return Math.max(minimum, Math.min(maximum, roll));
    },
    pick(items) {
      const first = items[0];
      if (first === undefined) {
        throw new Error("cannot pick from an empty collection");
      }
      return first;
    },
    fork() {
      return fixedRollRandom(roll);
    },
    snapshot() {
      return { seed: `fixed-${roll}`, cursor };
    },
  };
}

function stats(
  playerId: UserMatchPlayerPerformance["playerId"],
  overrides: Partial<UserMatchPlayerPerformance> = {},
): UserMatchPlayerPerformance {
  return {
    playerId,
    points: 0,
    attackPoints: 0,
    blockPoints: 0,
    serviceAces: 0,
    defensePoints: 0,
    serveAttempts: 0,
    serveErrors: 0,
    attackAttempts: 0,
    receiveAttempts: 0,
    perfectReceives: 0,
    idealSets: 0,
    successfulDigs: 0,
    clutchPoints: 0,
    clutchAttackPoints: 0,
    clutchBlockPoints: 0,
    clutchServiceAces: 0,
    attackSuccessRate: 0,
    perfectReceiveRate: 0,
    ...overrides,
  };
}

function performance(
  state: ReturnType<typeof createDemoGame>,
  playerStats: readonly UserMatchPlayerPerformance[],
  userWon = false,
): UserMatchPerformanceSnapshot {
  const ids = playerStats.map((item) => item.playerId);
  return {
    matchId: matchId("phase50-normal-acquisition"),
    userSchoolId: state.userSchoolId,
    userWon,
    completedSetCount: 2,
    appearanceParticipantIds: ids,
    experienceParticipantIds: ids,
    players: new Map(playerStats.map((item) => [item.playerId, item])),
  };
}

describe("match Normal special ability acquisition", () => {
  it("keeps every match-acquirable ability in the Normal rarity", () => {
    for (const abilityId of MATCH_NORMAL_ABILITY_IDS) {
      expect(getSpecialAbilityDefinition(abilityId)?.kind, abilityId).toBe(
        "positive",
      );
    }
  });

  it("uses the 15% practice-match boundary and stores no partial progress", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      specialAbilityIds: [],
      specialAbilityTipLevels: {},
    };
    const snapshot = performance(state, [
      stats(playerId, { serviceAces: 2, points: 2 }),
    ]);

    const success = applyMatchNormalAbilityAcquisition({
      state,
      performance: snapshot,
      context: { kind: "practice" },
      random: fixedRollRandom(15),
    });
    expect(success.acquisitions).toEqual([
      expect.objectContaining({
        playerId,
        abilityId: "receive_breaker",
        chancePercent: 15,
      }),
    ]);
    expect(success.state.players[playerId]!.specialAbilityIds).toContain(
      "receive_breaker",
    );
    expect(success.state.players[playerId]!.specialAbilityTipLevels).toEqual(
      {},
    );

    const failure = applyMatchNormalAbilityAcquisition({
      state,
      performance: snapshot,
      context: { kind: "practice" },
      random: fixedRollRandom(16),
    });
    expect(failure.acquisitions).toEqual([]);
    expect(failure.state.players[playerId]!.specialAbilityIds).not.toContain(
      "receive_breaker",
    );
    expect(failure.state.players[playerId]!.specialAbilityTipLevels).toEqual(
      {},
    );
  });

  it("does not award a different ability when the same match is retried", () => {
    const state = createDemoGame();
    const playerIds = state.schools[state.userSchoolId]!.playerIds.slice(0, 3);
    for (const playerId of playerIds) {
      state.players[playerId] = {
        ...state.players[playerId]!,
        specialAbilityIds: [],
      };
    }
    const snapshot = performance(
      state,
      playerIds.map((playerId) =>
        stats(playerId, {
          points: 2,
          serviceAces: 2,
          serveAttempts: 4,
          serveErrors: 0,
        }),
      ),
    );

    const first = applyMatchNormalAbilityAcquisition({
      state,
      performance: snapshot,
      context: { kind: "practice" },
      random: fixedRollRandom(1),
    });
    const second = applyMatchNormalAbilityAcquisition({
      state: first.state,
      performance: snapshot,
      context: { kind: "practice" },
      random: fixedRollRandom(1),
    });

    expect(first.acquisitions).toHaveLength(2);
    expect(second.acquisitions).toEqual([]);
    const learnedCounts = playerIds.map(
      (playerId) =>
        (second.state.players[playerId]!.specialAbilityIds ?? []).length,
    );
    expect(learnedCounts.filter((count) => count === 1)).toHaveLength(2);
    expect(learnedCounts.filter((count) => count === 0)).toHaveLength(1);
  });

  it("caps a national-final MVP standout chance at 40%", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      specialAbilityIds: [],
    };
    const snapshot = performance(
      state,
      [stats(playerId, { serviceAces: 3, points: 3 })],
      true,
    );

    const result = applyMatchNormalAbilityAcquisition({
      state,
      performance: snapshot,
      context: {
        kind: "official",
        level: "national",
        round: "final",
      },
      random: fixedRollRandom(40),
    });

    expect(result.acquisitions).toEqual([
      expect.objectContaining({
        playerId,
        abilityId: "receive_breaker",
        chancePercent: 40,
      }),
    ]);
  });

  it("limits acquisition to one ability per player and two players per match", () => {
    const state = createDemoGame();
    const playerIds = state.schools[state.userSchoolId]!.playerIds.slice(0, 3);
    for (const playerId of playerIds) {
      state.players[playerId] = {
        ...state.players[playerId]!,
        specialAbilityIds: [],
      };
    }
    const snapshot = performance(
      state,
      playerIds.map((playerId) =>
        stats(playerId, {
          points: 2,
          serviceAces: 2,
          serveAttempts: 4,
          serveErrors: 0,
        }),
      ),
    );

    const result = applyMatchNormalAbilityAcquisition({
      state,
      performance: snapshot,
      context: { kind: "practice" },
      random: fixedRollRandom(1),
    });

    expect(result.acquisitions).toHaveLength(2);
    expect(new Set(result.acquisitions.map((item) => item.playerId)).size).toBe(
      2,
    );
    for (const item of result.acquisitions) {
      const learned = result.state.players[item.playerId]!.specialAbilityIds;
      expect(learned).toHaveLength(1);
    }
  });
});
