import type { GameState } from "../model/GameState";
import { applySchoolFundsChange } from "../school/schoolEconomy";
import type {
  SeasonAmbition,
  SeasonGoalDefinition,
  SeasonGoalResult,
  SeasonGoalSeasonSummary,
} from "./seasonGoalTypes";

export const seasonAmbitionRewardMultiplier: Record<SeasonAmbition, number> = {
  steady: 0.8,
  challenge: 1,
  bold: 1.4,
};

function baseSeasonGoalFundReward(goal: SeasonGoalDefinition): number {
  if (goal.kind === "regional-rank") return 120;
  if (goal.kind === "official-wins") {
    return Math.max(100, Math.min(245, goal.target * 35));
  }
  if (goal.achievement === "national-title") return 500;
  if (goal.achievement === "national-appearance") return 300;
  return 200;
}

export function seasonGoalFundReward(
  goal: SeasonGoalDefinition,
  ambition: SeasonAmbition = "challenge",
): number {
  const raw =
    baseSeasonGoalFundReward(goal) * seasonAmbitionRewardMultiplier[ambition];
  return Math.max(5, Math.round(raw / 5) * 5);
}

export function seasonGoalRewardLabel(goal: SeasonGoalDefinition): string {
  if (goal.kind === "regional-rank") return "県内順位目標達成";
  if (goal.kind === "official-wins") return "公式戦勝利目標達成";
  if (goal.achievement === "national-title") return "全国大会優勝目標達成";
  if (goal.achievement === "national-appearance") return "全国大会出場目標達成";
  return "県大会優勝目標達成";
}

function rewardEntryId(goal: SeasonGoalDefinition): string {
  return `season-goal-reward:${goal.id}`;
}

export function seasonGoalEarnedFunds(
  goals: readonly SeasonGoalResult[],
  ambition: SeasonAmbition = "challenge",
): number {
  return goals.reduce(
    (total, goal) =>
      total + (goal.achieved ? seasonGoalFundReward(goal, ambition) : 0),
    0,
  );
}

export function grantCompletedSeasonGoalRewards(
  state: GameState,
  summary: SeasonGoalSeasonSummary,
): GameState {
  let next = state;

  for (const goal of summary.goalResults) {
    if (!goal.achieved) continue;
    const id = rewardEntryId(goal);
    if (next.schoolManagement.fundsHistory.some((entry) => entry.id === id)) {
      continue;
    }
    next = applySchoolFundsChange(next, {
      id,
      kind: "season-goal-reward",
      amount: seasonGoalFundReward(goal, summary.ambition ?? "challenge"),
      label: seasonGoalRewardLabel(goal),
      relatedId: goal.id,
    }).state;
  }

  return next;
}
