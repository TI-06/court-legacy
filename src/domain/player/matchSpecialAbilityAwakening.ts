import type { GameDataRegistry } from "../../data/dataRegistry";
import { playerMatchesEventTrigger } from "../events/eventEligibility";
import type { GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";
import type {
  UserMatchPerformanceSnapshot,
  UserMatchPlayerPerformance,
} from "../match/userMatchPerformance";
import type {
  MatchNormalAbilityContext,
} from "./matchSpecialAbilityAcquisition";
import {
  applySpecialAbilityAwakening,
  getSpecialAbilityAwakeningDefinition,
  type SpecialAbilityAwakeningDefinition,
} from "./specialAbilityAwakening";
import { getSpecialAbilityDefinition } from "./specialAbilities";

export interface MatchSpecialAbilityAwakening {
  playerId: PlayerId;
  abilityId: string;
  rarity: "rare" | "super-rare";
  chancePercent: number;
}

export interface ApplyMatchSpecialAbilityAwakeningInput {
  state: GameState;
  data: GameDataRegistry;
  performance: UserMatchPerformanceSnapshot;
  context: MatchNormalAbilityContext;
  random: RandomSource;
}

export interface ApplyMatchSpecialAbilityAwakeningResult {
  state: GameState;
  awakenings: readonly MatchSpecialAbilityAwakening[];
  awakenedPlayerIds: readonly PlayerId[];
}

function relatedPlay(
  awakening: SpecialAbilityAwakeningDefinition,
  stats: UserMatchPlayerPerformance,
  userWon: boolean,
): boolean {
  const target = getSpecialAbilityDefinition(awakening.targetAbilityId);
  if (!target) return false;

  switch (target.category) {
    case "serve":
      return (
        stats.serviceAces >= 2 ||
        stats.clutchServiceAces >= 1 ||
        (stats.serveAttempts >= 6 && stats.serveErrors === 0)
      );
    case "attack":
      return (
        (stats.attackPoints >= 5 && stats.attackSuccessRate >= 50) ||
        stats.clutchAttackPoints >= 2
      );
    case "set":
      return stats.idealSets >= 5;
    case "receive":
      return stats.perfectReceives >= 4 || stats.successfulDigs >= 3;
    case "block":
      return stats.blockPoints >= 2;
    case "mental":
    case "team":
      return userWon && stats.clutchPoints >= 2;
    case "overall":
      return (
        stats.points >= 5 &&
        (stats.perfectReceives >= 2 || stats.successfulDigs >= 2)
      );
    case "decision":
      return (
        stats.idealSets >= 4 ||
        stats.blockPoints >= 2 ||
        stats.clutchPoints >= 2
      );
    case "physical":
    case "growth":
      return false;
  }
}

function awakeningChance(
  rarity: SpecialAbilityAwakeningDefinition["rarity"],
  context: MatchNormalAbilityContext,
): number {
  if (rarity === "super-rare") {
    if (context.kind !== "official" || context.level !== "national") return 0;
    if (context.round === "final") return 18;
    if (context.round === "semifinal") return 12;
    return 8;
  }

  if (context.kind === "practice") return 5;
  if (context.level === "prefectural") return 10;
  if (context.round === "semifinal" || context.round === "final") return 25;
  return 18;
}

function eligibleAwakenings(
  input: ApplyMatchSpecialAbilityAwakeningInput,
  catalog: readonly SpecialAbilityAwakeningDefinition[],
  playerId: PlayerId,
  stats: UserMatchPlayerPerformance,
): SpecialAbilityAwakeningDefinition[] {
  const player = input.state.players[playerId];
  if (!player) return [];

  const result: SpecialAbilityAwakeningDefinition[] = [];
  for (const awakening of catalog) {
    const event = awakening.event;
    if (!playerMatchesEventTrigger(player, event.trigger)) continue;
    if (
      event.trigger.recentMatchResult === "win" &&
      !input.performance.userWon
    ) {
      continue;
    }
    if (
      event.trigger.recentMatchResult === "loss" &&
      input.performance.userWon
    ) {
      continue;
    }
    if (!relatedPlay(awakening, stats, input.performance.userWon)) continue;
    if (awakeningChance(awakening.rarity, input.context) <= 0) continue;
    result.push(awakening);
  }
  return result;
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

export function applyMatchSpecialAbilityAwakening(
  input: ApplyMatchSpecialAbilityAwakeningInput,
): ApplyMatchSpecialAbilityAwakeningResult {
  const catalog = [...input.data.events.values()]
    .map(getSpecialAbilityAwakeningDefinition)
    .filter(
      (awakening): awakening is SpecialAbilityAwakeningDefinition =>
        awakening !== null,
    );
  const rankedPlayers = [...input.performance.players.values()].sort(
    (left, right) =>
      performanceScore(right) - performanceScore(left) ||
      left.playerId.localeCompare(right.playerId),
  );

  for (const rarity of ["super-rare", "rare"] as const) {
    for (const stats of rankedPlayers) {
      const candidates = eligibleAwakenings(
        input,
        catalog,
        stats.playerId,
        stats,
      ).filter((candidate) => candidate.rarity === rarity);
      if (candidates.length === 0) continue;

      const chosen = input.random
        .fork(`awakening-candidate:${rarity}:${stats.playerId}`)
        .pick(candidates);
      const chance = awakeningChance(chosen.rarity, input.context);
      const roll = input.random
        .fork(
          `awakening-roll:${stats.playerId}:${chosen.targetAbilityId}`,
        )
        .int(1, 100);
      if (roll > chance) continue;

      const player = input.state.players[stats.playerId];
      if (!player) continue;
      const awakened = applySpecialAbilityAwakening(player, chosen);

      return {
        state: {
          ...input.state,
          players: {
            ...input.state.players,
            [stats.playerId]: awakened,
          },
        },
        awakenings: [
          {
            playerId: stats.playerId,
            abilityId: chosen.targetAbilityId,
            rarity: chosen.rarity,
            chancePercent: chance,
          },
        ],
        awakenedPlayerIds: [stats.playerId],
      };
    }
  }

  return {
    state: input.state,
    awakenings: [],
    awakenedPlayerIds: [],
  };
}
