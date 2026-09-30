import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import type {
  UserMatchPerformanceSnapshot,
  UserMatchPlayerPerformance,
} from "../../../../src/domain/match/userMatchPerformance";
import { matchId } from "../../../../src/domain/model/identifiers";
import { applyMatchSpecialAbilityAwakening } from "../../../../src/domain/player/matchSpecialAbilityAwakening";
import { getSpecialAbilityAwakeningDefinition } from "../../../../src/domain/player/specialAbilityAwakening";
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
      if (!first) throw new Error("cannot pick from an empty collection");
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
  playerStats: UserMatchPlayerPerformance,
  userWon = true,
): UserMatchPerformanceSnapshot {
  return {
    matchId: matchId("phase50-awakening"),
    userSchoolId: state.userSchoolId,
    userWon,
    completedSetCount: 2,
    appearanceParticipantIds: [playerStats.playerId],
    experienceParticipantIds: [playerStats.playerId],
    players: new Map([[playerStats.playerId, playerStats]]),
  };
}

describe("match special ability awakening", () => {
  it("derives all 15 Rare and 10 Super Rare upgrades from event data", () => {
    const awakenings = [...gameData.events.values()]
      .map(getSpecialAbilityAwakeningDefinition)
      .filter((awakening) => awakening !== null);

    expect(
      awakenings.filter((awakening) => awakening.rarity === "rare"),
    ).toHaveLength(15);
    expect(
      awakenings.filter((awakening) => awakening.rarity === "super-rare"),
    ).toHaveLength(10);
    expect(
      awakenings.every((awakening) => awakening.consumedAbilityIds.length >= 2),
    ).toBe(true);
  });

  it("awakens a Rare ability from qualifying official-match play", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    state.players[playerId] = {
      ...player,
      abilities: {
        ...player.abilities,
        spike: 80,
        decision: 78,
      },
      specialAbilityIds: ["attack_course", "attack_blockout"],
    };

    const result = applyMatchSpecialAbilityAwakening({
      state,
      data: gameData,
      performance: performance(
        state,
        stats(playerId, {
          points: 5,
          attackPoints: 5,
          attackAttempts: 8,
          attackSuccessRate: 65,
        }),
      ),
      context: {
        kind: "official",
        level: "prefectural",
        round: "quarterfinal",
      },
      random: fixedRollRandom(10),
    });

    expect(result.awakenings).toEqual([
      expect.objectContaining({
        playerId,
        abilityId: "elite_court_hitter",
        rarity: "rare",
        chancePercent: 10,
      }),
    ]);
    expect(result.state.players[playerId]!.specialAbilityIds).toContain(
      "elite_court_hitter",
    );
    expect(result.state.players[playerId]!.specialAbilityIds).not.toContain(
      "attack_course",
    );
    expect(result.state.players[playerId]!.specialAbilityIds).not.toContain(
      "attack_blockout",
    );
  });

  it("awakens a Super Rare ability in a qualifying national final", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    state.players[playerId] = {
      ...player,
      abilities: {
        ...player.abilities,
        spike: 92,
        mental: 85,
      },
      specialAbilityIds: ["elite_court_hitter", "elite_block_crusher"],
    };

    const result = applyMatchSpecialAbilityAwakening({
      state,
      data: gameData,
      performance: performance(
        state,
        stats(playerId, {
          points: 6,
          attackPoints: 6,
          attackAttempts: 9,
          attackSuccessRate: 67,
        }),
        true,
      ),
      context: {
        kind: "official",
        level: "national",
        round: "final",
      },
      random: fixedRollRandom(18),
    });

    expect(result.awakenings).toEqual([
      expect.objectContaining({
        playerId,
        abilityId: "gold_absolute_ace",
        rarity: "super-rare",
        chancePercent: 18,
      }),
    ]);
    expect(result.state.players[playerId]!.specialAbilityIds).toContain(
      "gold_absolute_ace",
    );
    expect(result.state.players[playerId]!.specialAbilityIds).not.toContain(
      "elite_court_hitter",
    );
    expect(result.state.players[playerId]!.specialAbilityIds).not.toContain(
      "elite_block_crusher",
    );
  });

  it("does not allow Super Rare awakening outside nationals", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    state.players[playerId] = {
      ...player,
      abilities: {
        ...player.abilities,
        spike: 92,
        mental: 85,
      },
      specialAbilityIds: ["elite_court_hitter", "elite_block_crusher"],
    };

    const result = applyMatchSpecialAbilityAwakening({
      state,
      data: gameData,
      performance: performance(
        state,
        stats(playerId, {
          points: 6,
          attackPoints: 6,
          attackAttempts: 9,
          attackSuccessRate: 67,
        }),
      ),
      context: {
        kind: "official",
        level: "prefectural",
        round: "final",
      },
      random: fixedRollRandom(1),
    });

    expect(result.awakenings).toEqual([]);
    expect(result.state.players[playerId]!.specialAbilityIds).toEqual([
      "elite_court_hitter",
      "elite_block_crusher",
    ]);
  });
});
