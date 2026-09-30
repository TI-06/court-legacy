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
  values: readonly UserMatchPlayerPerformance[],
  userWon = true,
): UserMatchPerformanceSnapshot {
  const ids = values.map((value) => value.playerId);
  return {
    matchId: matchId("phase50-negative-recovery"),
    userSchoolId: state.userSchoolId,
    userWon,
    completedSetCount: 2,
    appearanceParticipantIds: ids,
    experienceParticipantIds: ids,
    players: new Map(values.map((value) => [value.playerId, value])),
  };
}

describe("match negative ability recovery", () => {
  it("uses the 8% practice boundary for matching strong play", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      specialAbilityIds: ["serve_unstable"],
    };
    const snapshot = performance(state, [
      stats(playerId, {
        serveAttempts: 6,
        serveErrors: 0,
      }),
    ]);

    const success = applyMatchNegativeAbilityRecovery({
      state,
      performance: snapshot,
      context: { kind: "practice" },
      random: fixedRollRandom(8),
    });
    expect(success.recoveries).toEqual([
      expect.objectContaining({
        playerId,
        abilityId: "serve_unstable",
        chancePercent: 8,
      }),
    ]);
    expect(success.state.players[playerId]!.specialAbilityIds).not.toContain(
      "serve_unstable",
    );

    const failure = applyMatchNegativeAbilityRecovery({
      state,
      performance: snapshot,
      context: { kind: "practice" },
      random: fixedRollRandom(9),
    });
    expect(failure.recoveries).toEqual([]);
  });

  it("raises the chance to 28% in a national semifinal or final", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      specialAbilityIds: ["attack_low_finish"],
    };

    const result = applyMatchNegativeAbilityRecovery({
      state,
      performance: performance(state, [
        stats(playerId, {
          attackAttempts: 8,
          attackPoints: 5,
          attackSuccessRate: 63,
          points: 5,
        }),
      ]),
      context: {
        kind: "official",
        level: "national",
        round: "final",
      },
      random: fixedRollRandom(28),
    });

    expect(result.recoveries).toEqual([
      expect.objectContaining({
        abilityId: "attack_low_finish",
        chancePercent: 28,
      }),
    ]);
  });

  it("limits recovery to one player per match", () => {
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
            serviceAces: 2,
            serveAttempts: 6,
            serveErrors: 0,
            points: 2,
          }),
        ),
      ),
      context: {
        kind: "official",
        level: "prefectural",
        round: "quarterfinal",
      },
      random: fixedRollRandom(1),
    });

    expect(result.recoveries).toHaveLength(1);
    expect(result.recoveredPlayerIds).toHaveLength(1);
  });

  it("does not recover a player already used by a higher-priority awakening", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      specialAbilityIds: ["serve_unstable"],
    };

    const result = applyMatchNegativeAbilityRecovery({
      state,
      performance: performance(state, [
        stats(playerId, {
          serveAttempts: 6,
          serveErrors: 0,
        }),
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
});
