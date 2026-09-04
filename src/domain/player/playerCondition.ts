export type PlayerConditionLevel =
  "excellent" | "good" | "normal" | "poor" | "terrible";

export type PlayerConditionColorToken =
  "red" | "green" | "yellow" | "blue" | "purple";

export interface PlayerConditionPresentation {
  level: PlayerConditionLevel;
  label: "絶好調" | "好調" | "普通" | "不調" | "絶不調";
  icon: "😄" | "🙂" | "😐" | "☹️" | "😣";
  colorToken: PlayerConditionColorToken;
  matchMultiplier: 1.08 | 1.04 | 1 | 0.96 | 0.92;
}

function clampCondition(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getPlayerConditionPresentation(
  rawCondition: number,
): PlayerConditionPresentation {
  const condition = clampCondition(rawCondition);
  if (condition >= 85) {
    return {
      level: "excellent",
      label: "絶好調",
      icon: "😄",
      colorToken: "red",
      matchMultiplier: 1.08,
    };
  }
  if (condition >= 65) {
    return {
      level: "good",
      label: "好調",
      icon: "🙂",
      colorToken: "green",
      matchMultiplier: 1.04,
    };
  }
  if (condition >= 40) {
    return {
      level: "normal",
      label: "普通",
      icon: "😐",
      colorToken: "yellow",
      matchMultiplier: 1,
    };
  }
  if (condition >= 20) {
    return {
      level: "poor",
      label: "不調",
      icon: "☹️",
      colorToken: "blue",
      matchMultiplier: 0.96,
    };
  }
  return {
    level: "terrible",
    label: "絶不調",
    icon: "😣",
    colorToken: "purple",
    matchMultiplier: 0.92,
  };
}

export function getConditionMatchMultiplier(condition: number): number {
  return getPlayerConditionPresentation(condition).matchMultiplier;
}
