import type { GameState } from "../../domain/model/GameState";
import type { MatchState } from "../../domain/model/Match";
import { seasonAmbitionLabels } from "../../domain/season/seasonGoals";
import type { SeasonAmbition } from "../../domain/season/seasonGoalTypes";
import type { PracticeMatchCandidateTier } from "../../domain/weekly/weeklyScheduleTypes";

export interface PracticeMatchReviewPresentation {
  ambition: SeasonAmbition;
  ambitionLabel: string;
  tier: PracticeMatchCandidateTier;
  tierLabel: string;
  alignmentLabel: string;
  headline: string;
  strengthDifferenceLabel: string;
  nextRecommendation: string;
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

function classifyOpponentTier(
  userStrength: number,
  opponentStrength: number,
): PracticeMatchCandidateTier {
  const ratio = opponentStrength / Math.max(1, userStrength);
  if (ratio <= 1) return "same";
  if (ratio <= 1.15) return "stronger";
  return "challenge";
}

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
  const tier = classifyOpponentTier(userStrength, opponentStrength);
  const won =
    (userIsHome ? input.match.homeSetsWon : input.match.awaySetsWon) >
    (userIsHome ? input.match.awaySetsWon : input.match.homeSetsWon);
  const difference = opponentStrength - userStrength;

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
  };
}
