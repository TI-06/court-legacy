import type { Player } from "../model/Player";
import {
  summarizePlayerAbilities,
  type PlayerAbilitySummary,
} from "../selectors/playerPresentation";
import { ratingToGrade } from "../selectors/ratingGrades";
import type {
  DevelopmentGoalArea,
  DevelopmentGoalGrade,
  PlayerDevelopmentGoal,
} from "../team/teamPlanningTypes";

export const developmentGoalAreaLabels: Record<DevelopmentGoalArea, string> = {
  attack: "攻撃",
  defense: "守備",
  jump: "跳躍",
  stamina: "スタミナ",
  mental: "メンタル",
};

const gradeOrder: readonly DevelopmentGoalGrade[] = [
  "G",
  "F",
  "E",
  "D",
  "C",
  "B",
  "A",
  "S",
];

function gradeIndex(grade: DevelopmentGoalGrade): number {
  return gradeOrder.indexOf(grade);
}

export function playerDevelopmentAreaValue(
  player: Player,
  area: DevelopmentGoalArea,
): number {
  const summary: PlayerAbilitySummary = summarizePlayerAbilities(player);
  return summary[area];
}

export function nextDevelopmentTargetGrade(
  player: Player,
  area: DevelopmentGoalArea,
): DevelopmentGoalGrade {
  const current = ratingToGrade(
    playerDevelopmentAreaValue(player, area),
  ) as DevelopmentGoalGrade;
  const currentIndex = gradeIndex(current);
  return gradeOrder[Math.min(gradeOrder.length - 1, currentIndex + 1)]!;
}

export interface PlayerDevelopmentGoalProgress {
  area: DevelopmentGoalArea;
  areaLabel: string;
  currentValue: number;
  currentGrade: DevelopmentGoalGrade;
  targetGrade: DevelopmentGoalGrade;
  achieved: boolean;
}

export function getPlayerDevelopmentGoalProgress(
  player: Player,
  goal: PlayerDevelopmentGoal,
): PlayerDevelopmentGoalProgress {
  const currentValue = playerDevelopmentAreaValue(player, goal.area);
  const currentGrade = ratingToGrade(currentValue) as DevelopmentGoalGrade;

  return {
    area: goal.area,
    areaLabel: developmentGoalAreaLabels[goal.area],
    currentValue,
    currentGrade,
    targetGrade: goal.targetGrade,
    achieved: gradeIndex(currentGrade) >= gradeIndex(goal.targetGrade),
  };
}
