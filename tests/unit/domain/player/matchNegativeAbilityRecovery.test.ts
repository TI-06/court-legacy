import { createDemoGame } from "../../../../src/app/createDemoGame";
import type {
  UserMatchPerformanceSnapshot,
  UserMatchPlayerPerformance,
} from "../../../../src/domain/match/userMatchPerformance";
import { matchId } from "../../../../src/domain/model/identifiers";
import { applyMatchNegativeAbilityRecovery } from "../../../../src/domain/player/matchNegativeAbilityRecovery";
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
  userWon = true,
): UserMatchPerformanceSnapshot {
  const ids = playerStats.map((item) => item.playerId);
  return {
    matchId: matchId("phase50-negative-recovery"),
    userSchoolId: state.userSchoolId,
    userWon,
    completedSetCount: 2,
    appearanceParticipantIds: ids,
    experienceParticipantIds: ids,
    players: new Map(playerStats.map((item) => [item.playerId, item])),
  };
}

describe("match negative special ability recovery", () => {
  it("uses the 18% prefectural boundary for a clean serving performance", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      specialAbilityIds: ["serve_unstable"],
      specialAbilityTipLevels: { serve_stable: 2 },
    };
    const snapshot = performance(state, [
      stats(playerId, { serveAttempts: 6, serveErrors: 0 }),
    ]);

    const success = applyMatchNegativeAbilityRecovery({
      state,
      performance: snapshot,
      context: {
        kind: "official",
        level: "prefectural",
        round: "quarterfinal",
      },
      random: fixedRollRandom(18),
    });
    expect(success.recoveries).toEqual([
      {
        playerId,
        abilityId: "serve_unstable",
        chancePercent: 18,
      },
    ]);
    expect(success.state.players[playerId]!.specialAbilityIds).not.toContain(
      "serve_unstable",
    );
    expect(
      success.state.players[playerId]!.specialAbilityTipLevels,
    ).toBeUndefined();

    const failure = applyMatchNegativeAbilityRecovery({
      state,
      performance: snapshot,
      context: {
        kind: "official",
        level: "prefectural",
        round: "quarterfinal",
      },
      random: fixedRollRandom(19),
    });
    expect(failure.recoveries).toEqual([]);
    expect(failure.state.players[playerId]!.specialAbilityIds).toContain(
      "serve_unstable",
    );
  });

  it("raises recovery chance to 30% in a national final", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      specialAbilityIds: ["mental_choke"],
    };

    const result = applyMatchNegativeAbilityRecovery({
      state,
      performance: performance(
        state,
        [stats(playerId, { clutchPoints: 2, points: 2 })],
        true,
      ),
      context: {
        kind: "official",
        level: "national",
        round: "final",
      },
      random: fixedRollRandom(30),
    });

    expect(result.recoveries[0]).toMatchObject({
      playerId,
      abilityId: "mental_choke",
      chancePercent: 30,
    });
  });

  it("skips players already used by a higher-priority awakening", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      specialAbilityIds: ["serve_unstable"],
    };

    const result = applyMatchNegativeAbilityRecovery({
      state,
      performance: performance(state, [
        stats(playerId, { serveAttempts: 8, serveErrors: 0 }),
      ]),
      context: { kind: "practice" },
      excludedPlayerIds: [playerId],
      random: fixedRollRandom(1),
    });

    expect(result.recoveries).toEqual([]);
    expect(result.state.players[playerId]!.specialAbilityIds).toContain(
      "serve_unstable",
    );
  });

  it("limits recovery to one player per completed match", () => {
    const state = createDemoGame();
    const playerIds = state.schools[state.userSchoolId]!.playerIds.slice(0, 2);
    for (const playerId of playerIds) {
      state.players[playerId] = {
        ...state.players[playerId]!,
        specialAbilityIds: ["serve_unstable"],
      };
    }

    const result = applyMatchNegativeAbilityRecovery({
      state,
      performance: performance(
        state,
        playerIds.map((playerId) =>
          stats(playerId, {
            points: 2,
            serviceAces: 2,
            serveAttempts: 6,
            serveErrors: 0,
          }),
        ),
      ),
      context: { kind: "practice" },
      random: fixedRollRandom(1),
    });

    expect(result.recoveries).toHaveLength(1);
    expect(result.recoveredPlayerIds).toHaveLength(1);
  });
});
