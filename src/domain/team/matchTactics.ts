import type { Position } from "../model/Player";
import type { TeamTactics } from "../model/School";

export type ServePlan = "safe" | "balanced" | "aggressive";
export type AttackPlan = "side" | "balanced" | "quick";
export type BlockPlan = "commit" | "mixed" | "read";

export interface MatchTacticPlan {
  serve: ServePlan;
  attack: AttackPlan;
  block: BlockPlan;
}

export type PublicTacticSummary = MatchTacticPlan;

export type TacticMatchupRating = "favorable" | "neutral" | "unfavorable";

export interface TacticMatchupSummary {
  ownAttack: TacticMatchupRating;
  ownBlock: TacticMatchupRating;
  headline: TacticMatchupRating;
}

const SERVE_RISK_BY_PLAN = {
  safe: 25,
  balanced: 50,
  aggressive: 75,
} satisfies Record<ServePlan, number>;

const ATTACK_TEMPO_BY_PLAN = {
  side: "slow",
  balanced: "balanced",
  quick: "fast",
} satisfies Record<AttackPlan, TeamTactics["attackTempo"]>;

const ATTACK_DISTRIBUTION_BY_PLAN = {
  side: { OH: 45, MB: 15, OP: 36, S: 4, L: 0 },
  balanced: { OH: 40, MB: 22, OP: 34, S: 4, L: 0 },
  quick: { OH: 34, MB: 32, OP: 30, S: 4, L: 0 },
} satisfies Record<AttackPlan, Record<Position, number>>;

const ATTACK_BLOCK_MATCHUP_POINTS = {
  side: { commit: 3, mixed: 0, read: -3 },
  balanced: { commit: 0, mixed: 0, read: 0 },
  quick: { commit: -3, mixed: 0, read: 3 },
} satisfies Record<AttackPlan, Record<BlockPlan, number>>;

function deriveServePlan(serveRisk: number): ServePlan {
  if (serveRisk < 40) {
    return "safe";
  }
  if (serveRisk <= 60) {
    return "balanced";
  }
  return "aggressive";
}

function deriveAttackPlan(attackTempo: TeamTactics["attackTempo"]): AttackPlan {
  switch (attackTempo) {
    case "slow":
      return "side";
    case "balanced":
      return "balanced";
    case "fast":
      return "quick";
  }
}

function ratingFromPoints(points: number): TacticMatchupRating {
  if (points > 0) {
    return "favorable";
  }
  if (points < 0) {
    return "unfavorable";
  }
  return "neutral";
}

export function deriveMatchTacticPlan(tactics: TeamTactics): MatchTacticPlan {
  return {
    serve: deriveServePlan(tactics.serveRisk),
    attack: deriveAttackPlan(tactics.attackTempo),
    block: tactics.blockSystem,
  };
}

export function applyMatchTacticPlan(
  tactics: TeamTactics,
  plan: MatchTacticPlan,
): TeamTactics {
  return {
    ...tactics,
    serveRisk: SERVE_RISK_BY_PLAN[plan.serve],
    attackTempo: ATTACK_TEMPO_BY_PLAN[plan.attack],
    attackDistribution: { ...ATTACK_DISTRIBUTION_BY_PLAN[plan.attack] },
    blockSystem: plan.block,
  };
}

export function getAttackBlockMatchupPoints(
  attack: AttackPlan,
  block: BlockPlan,
): number {
  return ATTACK_BLOCK_MATCHUP_POINTS[attack][block];
}

export function summarizeTacticMatchup(
  own: PublicTacticSummary,
  opponent: PublicTacticSummary,
): TacticMatchupSummary {
  const ownAttackPoints = getAttackBlockMatchupPoints(
    own.attack,
    opponent.block,
  );
  const ownBlockPoints = -getAttackBlockMatchupPoints(
    opponent.attack,
    own.block,
  );

  return {
    ownAttack: ratingFromPoints(ownAttackPoints),
    ownBlock: ratingFromPoints(ownBlockPoints),
    headline: ratingFromPoints(ownAttackPoints + ownBlockPoints),
  };
}
