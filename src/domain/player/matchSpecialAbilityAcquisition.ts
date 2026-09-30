import type { GameState } from "../model/GameState";
import type { Player } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";
import type {
  TournamentLevel,
  TournamentRound,
} from "../tournament/tournamentTypes";
import type {
  UserMatchPerformanceSnapshot,
  UserMatchPlayerPerformance,
} from "../match/userMatchPerformance";
import { learnSpecialAbility } from "./specialAbilityProgression";
import { getSpecialAbilityDefinition } from "./specialAbilities";

export type MatchNormalAbilityContext =
  | { kind: "practice" }
  | {
      kind: "official";
      level: TournamentLevel;
      round: TournamentRound;
    };

export interface MatchNormalAbilityAcquisition {
  playerId: PlayerId;
  abilityId: string;
  chancePercent: number;
}

export interface ApplyMatchNormalAbilityAcquisitionInput {
  state: GameState;
  performance: UserMatchPerformanceSnapshot;
  context: MatchNormalAbilityContext;
  random: RandomSource;
}

export interface ApplyMatchNormalAbilityAcquisitionResult {
  state: GameState;
  acquisitions: readonly MatchNormalAbilityAcquisition[];
}

interface MatchAbilityRule {
  abilityId: string;
  eligible: (stats: UserMatchPlayerPerformance) => boolean;
  standout: (stats: UserMatchPlayerPerformance) => boolean;
}

const MATCH_NORMAL_ABILITY_RULES: readonly MatchAbilityRule[] = [
  {
    abilityId: "serve_stable",
    eligible: (stats) => stats.serveAttempts >= 4 && stats.serveErrors === 0,
    standout: (stats) => stats.serveAttempts >= 8 && stats.serveErrors === 0,
  },
  {
    abilityId: "receive_breaker",
    eligible: (stats) => stats.serviceAces >= 2,
    standout: (stats) => stats.serviceAces >= 3,
  },
  {
    abilityId: "serve_late_game",
    eligible: (stats) => stats.clutchServiceAces >= 1,
    standout: (stats) => stats.clutchServiceAces >= 2,
  },
  {
    abilityId: "attack_course",
    eligible: (stats) =>
      stats.attackAttempts >= 5 && stats.attackSuccessRate >= 50,
    standout: (stats) =>
      stats.attackAttempts >= 8 && stats.attackSuccessRate >= 65,
  },
  {
    abilityId: "attack_clutch",
    eligible: (stats) => stats.clutchAttackPoints >= 2,
    standout: (stats) => stats.clutchAttackPoints >= 3,
  },
  {
    abilityId: "set_stable",
    eligible: (stats) => stats.idealSets >= 5,
    standout: (stats) => stats.idealSets >= 8,
  },
  {
    abilityId: "receive_serve",
    eligible: (stats) =>
      stats.receiveAttempts >= 5 && stats.perfectReceiveRate >= 60,
    standout: (stats) =>
      stats.receiveAttempts >= 8 && stats.perfectReceiveRate >= 70,
  },
  {
    abilityId: "receive_dig",
    eligible: (stats) => stats.successfulDigs >= 3,
    standout: (stats) => stats.successfulDigs >= 5,
  },
  {
    abilityId: "block_touch",
    eligible: (stats) => stats.blockPoints >= 2,
    standout: (stats) => stats.blockPoints >= 3,
  },
  {
    abilityId: "mental_clutch",
    eligible: (stats) => stats.clutchPoints >= 2,
    standout: (stats) => stats.clutchPoints >= 3,
  },
];

const MAX_ACQUISITIONS_PER_MATCH = 2;

function baseChance(context: MatchNormalAbilityContext): number {
  if (context.kind === "practice") return 15;
  return context.level === "national" ? 30 : 22;
}

function roundBonus(context: MatchNormalAbilityContext): number {
  if (context.kind !== "official") return 0;
  return context.round === "semifinal" || context.round === "final" ? 5 : 0;
}

function performanceScore(stats: UserMatchPlayerPerformance): number {
  return (
    stats.points * 8 +
    stats.blockPoints * 2 +
    stats.serviceAces * 2 +
    stats.defensePoints * 1.5 +
    stats.perfectReceives * 0.5 +
    stats.idealSets * 0.3 +
    stats.successfulDigs * 0.5 +
    stats.attackSuccessRate * 0.02
  );
}

function mvpPlayerId(
  performance: UserMatchPerformanceSnapshot,
): PlayerId | null {
  if (!performance.userWon) return null;

  const ranked = [...performance.players.values()]
    .filter((stats) => performanceScore(stats) > 0)
    .sort(
      (left, right) =>
        performanceScore(right) - performanceScore(left) ||
        left.playerId.localeCompare(right.playerId),
    );
  return ranked[0]?.playerId ?? null;
}

function eligibleRules(
  player: Player,
  stats: UserMatchPlayerPerformance,
): readonly MatchAbilityRule[] {
  const owned = new Set(player.specialAbilityIds ?? []);
  return MATCH_NORMAL_ABILITY_RULES.filter((rule) => {
    if (owned.has(rule.abilityId) || !rule.eligible(stats)) return false;
    return getSpecialAbilityDefinition(rule.abilityId)?.kind === "positive";
  });
}

function acquisitionChance(
  context: MatchNormalAbilityContext,
  stats: UserMatchPlayerPerformance,
  rule: MatchAbilityRule,
  isMvp: boolean,
): number {
  return Math.min(
    40,
    baseChance(context) +
      roundBonus(context) +
      (isMvp ? 5 : 0) +
      (rule.standout(stats) ? 5 : 0),
  );
}

export function applyMatchNormalAbilityAcquisition(
  input: ApplyMatchNormalAbilityAcquisitionInput,
): ApplyMatchNormalAbilityAcquisitionResult {
  const players = { ...input.state.players };
  const acquisitions: MatchNormalAbilityAcquisition[] = [];
  const mvp = mvpPlayerId(input.performance);

  const rankedPlayers = [...input.performance.players.values()].sort(
    (left, right) =>
      performanceScore(right) - performanceScore(left) ||
      left.playerId.localeCompare(right.playerId),
  );

  for (const stats of rankedPlayers) {
    if (acquisitions.length >= MAX_ACQUISITIONS_PER_MATCH) break;

    const player = players[stats.playerId];
    if (!player || player.career.schoolId !== input.state.userSchoolId) {
      continue;
    }

    const rules = eligibleRules(player, stats);
    if (rules.length === 0) continue;

    const chosenRule = input.random
      .fork(`candidate:${stats.playerId}`)
      .pick(rules);
    const chance = acquisitionChance(
      input.context,
      stats,
      chosenRule,
      stats.playerId === mvp,
    );
    const roll = input.random
      .fork(`roll:${stats.playerId}:${chosenRule.abilityId}`)
      .int(1, 100);
    if (roll > chance) continue;

    const learned = learnSpecialAbility(player, chosenRule.abilityId);
    if (!learned.changes.some((change) => change.kind === "learned")) {
      continue;
    }

    players[stats.playerId] = learned.player;
    acquisitions.push({
      playerId: stats.playerId,
      abilityId: chosenRule.abilityId,
      chancePercent: chance,
    });
  }

  return {
    state:
      acquisitions.length > 0 ? { ...input.state, players } : input.state,
    acquisitions,
  };
}

export const matchNormalAbilityRules = MATCH_NORMAL_ABILITY_RULES;
