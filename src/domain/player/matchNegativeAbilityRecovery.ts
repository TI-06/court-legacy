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
  SPECIAL_ABILITIES,
  type SpecialAbilityCategory,
  type SpecialAbilityDefinition,
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

const NEGATIVE_ABILITIES = SPECIAL_ABILITIES.filter(
  (ability) => ability.kind === "negative",
);

function relatedPerformance(
  category: SpecialAbilityCategory,
  stats: UserMatchPlayerPerformance,
  userWon: boolean,
): boolean {
  switch (category) {
    case "serve":
      return (
        stats.serviceAces >= 2 ||
        (stats.serveAttempts >= 6 && stats.serveErrors === 0)
      );
    case "attack":
      return stats.attackAttempts >= 6 && stats.attackSuccessRate >= 50;
    case "set":
      return stats.idealSets >= 5;
    case "receive":
      return stats.perfectReceives >= 4 || stats.successfulDigs >= 3;
    case "block":
      return stats.blockPoints >= 2;
    case "mental":
    case "team":
      return userWon && stats.clutchPoints >= 2;
    case "physical":
      return stats.points + stats.blockPoints + stats.successfulDigs >= 4;
    case "growth":
    case "overall":
    case "decision":
      return false;
  }
}

function recoveryChance(context: MatchNormalAbilityContext): number {
  if (context.kind === "practice") return 8;
  if (context.level === "prefectural") return 15;
  return context.round === "semifinal" || context.round === "final" ? 28 : 22;
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

function ownedNegativeAbilities(
  state: GameState,
  playerId: PlayerId,
  stats: UserMatchPlayerPerformance,
  userWon: boolean,
): SpecialAbilityDefinition[] {
  const player = state.players[playerId];
  if (!player) return [];

  const owned = new Set(player.specialAbilityIds ?? []);
  return NEGATIVE_ABILITIES.filter(
    (ability) =>
      owned.has(ability.id) &&
      relatedPerformance(ability.category, stats, userWon),
  );
}

export function applyMatchNegativeAbilityRecovery(
  input: ApplyMatchNegativeAbilityRecoveryInput,
): ApplyMatchNegativeAbilityRecoveryResult {
  const excluded = new Set(input.excludedPlayerIds ?? []);
  const rankedPlayers = [...input.performance.players.values()].sort(
    (left, right) =>
      performanceScore(right) - performanceScore(left) ||
      left.playerId.localeCompare(right.playerId),
  );

  const chance = recoveryChance(input.context);
  for (const stats of rankedPlayers) {
    if (excluded.has(stats.playerId)) continue;

    const candidates = ownedNegativeAbilities(
      input.state,
      stats.playerId,
      stats,
      input.performance.userWon,
    );
    if (candidates.length === 0) continue;

    const chosen = input.random
      .fork(`negative-candidate:${stats.playerId}`)
      .pick(candidates);
    const roll = input.random
      .fork(`negative-roll:${stats.playerId}:${chosen.id}`)
      .int(1, 100);
    if (roll > chance) continue;

    const player = input.state.players[stats.playerId];
    if (!player) continue;
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
