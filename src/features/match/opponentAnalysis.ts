import type { GameState } from "../../domain/model/GameState";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import type {
  AttackPlan,
  BlockPlan,
  MatchTacticPlan,
  PublicTacticSummary,
} from "../../domain/team/matchTactics";
import { buildTeamProfile, type TeamProfile } from "./matchPresentation";

export type OpponentAnalysisTier = "basic" | "standard" | "advanced";

export interface OpponentAnalysisReport {
  score: number;
  tier: OpponentAnalysisTier;
  tierLabel: string;
  observations: string[];
  recommendedPlan: MatchTacticPlan;
  recommendedReasons: string[];
}

const PROFILE_LABELS: Record<keyof TeamProfile, string> = {
  attack: "攻撃",
  block: "ブロック",
  serve: "サーブ",
  receive: "レシーブ",
  teamwork: "連携",
  stamina: "スタミナ",
};

const ATTACK_LABELS: Record<AttackPlan, string> = {
  side: "サイド中心",
  balanced: "バランス",
  quick: "高速",
};

const BLOCK_LABELS: Record<BlockPlan, string> = {
  commit: "コミット",
  mixed: "ミックス",
  read: "リード",
};

function analysisTier(score: number): OpponentAnalysisTier {
  if (score >= 75) return "advanced";
  if (score >= 50) return "standard";
  return "basic";
}

function analysisTierLabel(tier: OpponentAnalysisTier): string {
  if (tier === "advanced") return "詳細分析";
  if (tier === "standard") return "標準分析";
  return "簡易分析";
}

function counterAttack(block: BlockPlan): AttackPlan {
  if (block === "commit") return "side";
  if (block === "read") return "quick";
  return "balanced";
}

function counterBlock(attack: AttackPlan): BlockPlan {
  if (attack === "side") return "read";
  if (attack === "quick") return "commit";
  return "mixed";
}

function sortedProfileKeys(profile: TeamProfile): Array<keyof TeamProfile> {
  return (Object.keys(profile) as Array<keyof TeamProfile>).sort(
    (left, right) => profile[right] - profile[left],
  );
}

export function calculateOpponentAnalysisScore(state: GameState): number {
  const school = state.schools[state.userSchoolId];
  if (!school) return 0;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(school.coach.observation + school.facilities.analysisRoom * 2),
    ),
  );
}

export function buildOpponentAnalysis(input: {
  state: GameState;
  opponentSelection: TeamSelection;
  opponentTactics: PublicTacticSummary;
  basePlan: MatchTacticPlan;
}): OpponentAnalysisReport {
  const score = calculateOpponentAnalysisScore(input.state);
  const tier = analysisTier(score);
  const profile = buildTeamProfile(input.state, input.opponentSelection);
  const sorted = sortedProfileKeys(profile);
  const strongest = sorted[0] ?? "attack";
  const weakest = sorted.at(-1) ?? "receive";

  const recommendedPlan: MatchTacticPlan = {
    ...input.basePlan,
    attack: counterAttack(input.opponentTactics.block),
    block: counterBlock(input.opponentTactics.attack),
    ...(tier === "advanced" && profile.receive < 60
      ? { serve: "aggressive" as const }
      : {}),
  };

  const observations = [
    `攻撃は${ATTACK_LABELS[input.opponentTactics.attack]}、ブロックは${BLOCK_LABELS[input.opponentTactics.block]}が中心。`,
  ];

  if (tier !== "basic") {
    observations.push(
      `${PROFILE_LABELS[strongest]}がチームの強み。ここを基準に守備を組みたい。`,
    );
  }

  if (tier === "advanced") {
    observations.push(
      `${PROFILE_LABELS[weakest]}は相対的に低め。試合の狙い所にできる。`,
    );
  }

  const recommendedReasons = [
    `相手の${BLOCK_LABELS[input.opponentTactics.block]}ブロックに対して、攻撃は${ATTACK_LABELS[recommendedPlan.attack]}。`,
    `相手の${ATTACK_LABELS[input.opponentTactics.attack]}攻撃に対して、ブロックは${BLOCK_LABELS[recommendedPlan.block]}。`,
  ];

  if (tier === "advanced" && recommendedPlan.serve === "aggressive") {
    recommendedReasons.push("レシーブが弱点なので、サーブは強気で崩しにいく。");
  }

  return {
    score,
    tier,
    tierLabel: analysisTierLabel(tier),
    observations,
    recommendedPlan,
    recommendedReasons,
  };
}
