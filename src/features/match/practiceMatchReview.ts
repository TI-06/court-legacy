import type { GameState } from "../../domain/model/GameState";
import type { MatchState } from "../../domain/model/Match";
import { seasonAmbitionLabels } from "../../domain/season/seasonGoals";
import {
  buildMatchStatSummary,
  type TeamMatchStats,
} from "./matchPresentation";
import type { SeasonAmbition } from "../../domain/season/seasonGoalTypes";
import { classifyPracticeOpponentTier } from "../../domain/weekly/practiceMatchPlanning";
import type { PracticeMatchCandidateTier } from "../../domain/weekly/weeklyScheduleTypes";

export interface PracticeTrainingRecommendation {
  focus: "attack" | "receive" | "serve" | "block" | "balanced";
  menuId:
    | "training.spike"
    | "training.receive"
    | "training.serve"
    | "training.block"
    | "training.scrimmage";
  menuName: string;
  reason: string;
}

export interface PracticeMatchReviewPresentation {
  ambition: SeasonAmbition;
  ambitionLabel: string;
  tier: PracticeMatchCandidateTier;
  tierLabel: string;
  alignmentLabel: string;
  headline: string;
  strengthDifferenceLabel: string;
  nextRecommendation: string;
  trainingRecommendation: PracticeTrainingRecommendation;
}

const tierLabels: Record<PracticeMatchCandidateTier, string> = {
  same: "同程度",
  stronger: "格上",
  challenge: "強豪",
};

const tierOrder: Record<PracticeMatchCandidateTier, number> = {
  same: 0,
  stronger: 1,
  challenge: 2,
};

const preferredTierByAmbition: Record<
  SeasonAmbition,
  PracticeMatchCandidateTier
> = {
  steady: "same",
  challenge: "stronger",
  bold: "challenge",
};

function alignmentLabel(
  ambition: SeasonAmbition,
  tier: PracticeMatchCandidateTier,
): string {
  const preferred = preferredTierByAmbition[ambition];
  if (tier === preferred) return "方針一致";
  return tierOrder[tier] > tierOrder[preferred]
    ? "方針より高負荷"
    : "方針より低負荷";
}

function headline(tier: PracticeMatchCandidateTier, won: boolean): string {
  if (tier === "same") {
    return won ? "安定した試合運びを確認" : "基礎完成度に課題";
  }
  if (tier === "stronger") {
    return won ? "格上対応に手応え" : "格上戦で課題を発見";
  }
  return won ? "強豪相手に成果" : "強豪基準の課題を収集";
}

function nextRecommendation(
  tier: PracticeMatchCandidateTier,
  won: boolean,
): string {
  if (won) {
    if (tier === "same") return "次は格上候補へ";
    if (tier === "stronger") return "次は強豪候補へ";
    return "強豪戦を継続";
  }

  if (tier === "same") return "同程度でもう一度確認";
  if (tier === "stronger") return "格上戦を継続";
  return "次は格上候補で立て直し";
}

function recommendationSeverity(
  user: TeamMatchStats,
  opponent: TeamMatchStats,
): Record<Exclude<PracticeTrainingRecommendation["focus"], "balanced">, number> {
  const userServeNet = user.serviceAces - user.serveErrors;
  const opponentServeNet = opponent.serviceAces - opponent.serveErrors;
  return {
    attack: Math.max(
      0,
      (35 - user.attackSuccessRate) / 10,
      (opponent.attackSuccessRate - user.attackSuccessRate) / 10,
    ),
    receive: Math.max(
      0,
      (35 - user.perfectReceiveRate) / 10,
      (opponent.perfectReceiveRate - user.perfectReceiveRate) / 10,
    ),
    serve: Math.max(
      0,
      (user.serveErrors - user.serviceAces) / 2,
      (opponentServeNet - userServeNet) / 2,
    ),
    block: Math.max(0, (opponent.blockPoints - user.blockPoints) / 2),
  };
}

export function recommendPracticeTrainingFromStats(
  user: TeamMatchStats,
  opponent: TeamMatchStats,
): PracticeTrainingRecommendation {
  const severity = recommendationSeverity(user, opponent);
  const ranked = (
    Object.entries(severity) as [
      Exclude<PracticeTrainingRecommendation["focus"], "balanced">,
      number,
    ][]
  ).sort(
    (left, right) =>
      right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  const [focus, score] = ranked[0] ?? ["attack", 0];

  if (score < 1) {
    return {
      focus: "balanced",
      menuId: "training.scrimmage",
      menuName: "実戦形式",
      reason: "大きな弱点差なし。実戦形式で連携を継続",
    };
  }

  if (focus === "attack") {
    return {
      focus,
      menuId: "training.spike",
      menuName: "スパイク練習",
      reason: `アタック決定率 ${user.attackSuccessRate}% / 相手 ${opponent.attackSuccessRate}%`,
    };
  }
  if (focus === "receive") {
    return {
      focus,
      menuId: "training.receive",
      menuName: "サーブレシーブ",
      reason: `好返球率 ${user.perfectReceiveRate}% / 相手 ${opponent.perfectReceiveRate}%`,
    };
  }
  if (focus === "serve") {
    return {
      focus,
      menuId: "training.serve",
      menuName: "サーブ練習",
      reason: `サーブ エース${user.serviceAces} / ミス${user.serveErrors}`,
    };
  }
  return {
    focus: "block",
    menuId: "training.block",
    menuName: "ブロック練習",
    reason: `ブロック得点 ${user.blockPoints} / 相手 ${opponent.blockPoints}`,
  };
}

export function buildPracticeMatchReview(input: {
  state: GameState;
  match: MatchState;
  homeStrength: number;
  awayStrength: number;
}): PracticeMatchReviewPresentation {
  const userIsHome = input.match.homeSchoolId === input.state.userSchoolId;
  const userStrength = userIsHome ? input.homeStrength : input.awayStrength;
  const opponentStrength = userIsHome ? input.awayStrength : input.homeStrength;
  const ambition = input.state.seasonGoals?.ambition ?? "challenge";
  const tier = classifyPracticeOpponentTier(userStrength, opponentStrength);
  const won =
    (userIsHome ? input.match.homeSetsWon : input.match.awaySetsWon) >
    (userIsHome ? input.match.awaySetsWon : input.match.homeSetsWon);
  const difference = opponentStrength - userStrength;
  const stats = buildMatchStatSummary(input.state, input.match);
  const userStats = userIsHome ? stats.home : stats.away;
  const opponentStats = userIsHome ? stats.away : stats.home;

  return {
    ambition,
    ambitionLabel: seasonAmbitionLabels[ambition],
    tier,
    tierLabel: tierLabels[tier],
    alignmentLabel: alignmentLabel(ambition, tier),
    headline: headline(tier, won),
    strengthDifferenceLabel:
      difference === 0
        ? "戦力差 ±0"
        : `戦力差 ${difference > 0 ? "+" : ""}${difference}`,
    nextRecommendation: nextRecommendation(tier, won),
    trainingRecommendation: recommendPracticeTrainingFromStats(
      userStats,
      opponentStats,
    ),
  };
}
