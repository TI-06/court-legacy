import type { GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";
import type {
  UserMatchPerformanceSnapshot,
  UserMatchPlayerPerformance,
} from "../match/userMatchPerformance";
import type { MatchNormalAbilityContext } from "./matchSpecialAbilityAcquisition";
import { removeNegativeSpecialAbility } from "./specialAbilityProgression";
import {
  getSpecialAbilityDefinition,
  type SpecialAbilityCategory,
} from "./specialAbilities";

export interface MatchNegativeAbilityRecovery {
  playerId: PlayerId;
  abilityId: string;
  chancePercent: number;
}

export interface ApplyMatchNegativeAbilityRecoveryInput {
  state: GameState;
  performance: UserMatchPerformanceSnapshot;
  context: MatchNormalAbilityContext;
  random: RandomSource;
  excludedPlayerIds?: readonly PlayerId[];
}

export interface ApplyMatchNegativeAbilityRecoveryResult {
  state: GameState;
  recoveries: readonly MatchNegativeAbilityRecovery[];
  recoveredPlayerIds: readonly PlayerId[];
}

function recoveryChance(context: MatchNormalAbilityContext): number {
  if (context.kind === "practice") return 10;
  const base = context.level === "national" ? 25 : 18;
  return context.round === "semifinal" || context.round === "final"
    ? base + 5
    : base;
}

function hasRecoveryPerformance(
  category: SpecialAbilityCategory,
  stats: UserMatchPlayerPerformance,
  performance: UserMatchPerformanceSnapshot,
): boolean {
  switch (category) {
    case "serve":
      return (
        stats.serviceAces >= 2 ||
        (stats.serveAttempts >= 6 && stats.serveErrors === 0)
      );
    case "attack":
      return stats.attackAttempts >= 6 && stats.attackSuccessRate >= 55;
    case "set":
      return stats.idealSets >= 6;
    case "receive":
      return (
        (stats.receiveAttempts >= 6 && stats.perfectReceiveRate >= 65) ||
        stats.successfulDigs >= 4
      );
    case "block":
      return stats.blockPoints >= 2;
    case "mental":
    case "team":
      return performance.userWon && stats.clutchPoints >= 2;
    case "physical":
      return (
        performance.completedSetCount >= 2 &&
        stats.points +
          stats.blockPoints +
          stats.successfulDigs +
          stats.idealSets >=
          4
      );
    case "overall":
    case "decision":
    case "growth":
      return false;
  }
}

function performanceScore(stats: UserMatchPlayerPerformance): number {
  return (
    stats.points * 8 +
    stats.blockPoints * 2 +
    stats.serviceAces * 2 +
    stats.perfectReceives +
    stats.idealSets * 0.5 +
    stats.successfulDigs
  );
}

export function applyMatchNegativeAbilityRecovery(
  input: ApplyMatchNegativeAbilityRecoveryInput,
): ApplyMatchNegativeAbilityRecoveryResult {
  const excluded = new Set(input.excludedPlayerIds ?? []);
  const players = [...input.performance.players.values()].sort(
    (left, right) =>
      performanceScore(right) - performanceScore(left) ||
      left.playerId.localeCompare(right.playerId),
  );

  for (const stats of players) {
    if (excluded.has(stats.playerId)) continue;

    const player = input.state.players[stats.playerId];
    if (!player || player.career.schoolId !== input.state.userSchoolId) {
      continue;
    }

    const candidates = (player.specialAbilityIds ?? []).flatMap((abilityId) => {
      const ability = getSpecialAbilityDefinition(abilityId);
      return ability?.kind === "negative" &&
        hasRecoveryPerformance(ability.category, stats, input.performance)
        ? [ability]
        : [];
    });
    if (candidates.length === 0) continue;

    const chosen = input.random
      .fork(`negative-candidate:${stats.playerId}`)
      .pick(candidates);
    const chance = recoveryChance(input.context);
    const roll = input.random
      .fork(`negative-roll:${stats.playerId}:${chosen.id}`)
      .int(1, 100);
    if (roll > chance) continue;

    const recovered = removeNegativeSpecialAbility(player, chosen.id);
    if (
      !recovered.changes.some((change) => change.kind === "negative-removed")
    ) {
      continue;
    }

    return {
      state: {
        ...input.state,
        players: {
          ...input.state.players,
          [stats.playerId]: recovered.player,
        },
      },
      recoveries: [
        {
          playerId: stats.playerId,
          abilityId: chosen.id,
          chancePercent: chance,
        },
      ],
      recoveredPlayerIds: [stats.playerId],
    };
  }

  return {
    state: input.state,
    recoveries: [],
    recoveredPlayerIds: [],
  };
}
