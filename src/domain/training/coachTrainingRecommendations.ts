import type { GameState } from "../model/GameState";
import type { Player } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import {
  getPlayerDevelopmentGoalProgress,
  type PlayerDevelopmentGoalProgress,
} from "../player/playerDevelopmentGoals";
import { summarizePlayerAbilities } from "../selectors/playerPresentation";
import { ratingToGrade } from "../selectors/ratingGrades";

export type CoachTrainingRecommendationReason =
  | "injury"
  | "condition"
  | "development-goal"
  | "balanced"
  | "assistant-specialty"
  | "weakness";

export interface CoachTrainingRecommendation {
  playerId: PlayerId;
  instructionId: string;
  instructionName: string;
  reason: CoachTrainingRecommendationReason;
  reasonLabel: string;
}

export type CoachRecommendationQuality = "basic" | "standard" | "detailed";

const instructionNames: Record<string, string> = {
  "instruction.overall": "全体",
  "instruction.attack": "攻撃",
  "instruction.defense": "守備",
  "instruction.jump": "跳躍",
  "instruction.fitness": "体力",
  "instruction.rest": "休養",
};

function goalInstruction(
  goal: PlayerDevelopmentGoalProgress,
): Pick<CoachTrainingRecommendation, "instructionId" | "instructionName"> {
  switch (goal.area) {
    case "attack":
      return { instructionId: "instruction.attack", instructionName: "攻撃" };
    case "defense":
      return { instructionId: "instruction.defense", instructionName: "守備" };
    case "jump":
      return { instructionId: "instruction.jump", instructionName: "跳躍" };
    case "stamina":
    case "mental":
      return { instructionId: "instruction.fitness", instructionName: "体力" };
  }
}

function weakestArea(player: Player) {
  const summary = summarizePlayerAbilities(player);
  const ranked = (
    Object.entries(summary) as Array<[keyof typeof summary, number]>
  ).sort((left, right) => {
    if (left[1] !== right[1]) return left[1] - right[1];
    return left[0].localeCompare(right[0]);
  });
  return { summary, ranked, weakest: ranked[0]! };
}

function specialtyArea(
  state: GameState,
  player: Player,
): keyof ReturnType<typeof summarizePlayerAbilities> | null {
  const contract = state.schoolManagement.assistantCoach;
  if (!contract || contract.contractYearIndex !== state.yearIndex) return null;

  const { summary, weakest } = weakestArea(player);
  const nearWeakness = (key: keyof typeof summary) =>
    summary[key] <= weakest[1] + 5;

  if (contract.specialty === "attack" && nearWeakness("attack")) return "attack";
  if (contract.specialty === "defense" && nearWeakness("defense")) {
    return "defense";
  }
  if (contract.specialty === "physical") {
    const physical =
      summary.jump <= summary.stamina ? ("jump" as const) : ("stamina" as const);
    if (nearWeakness(physical)) return physical;
  }
  return null;
}

function areaInstruction(
  area: keyof ReturnType<typeof summarizePlayerAbilities>,
): Pick<CoachTrainingRecommendation, "instructionId" | "instructionName"> {
  switch (area) {
    case "attack":
      return { instructionId: "instruction.attack", instructionName: "攻撃" };
    case "defense":
      return { instructionId: "instruction.defense", instructionName: "守備" };
    case "jump":
      return { instructionId: "instruction.jump", instructionName: "跳躍" };
    case "stamina":
    case "mental":
      return { instructionId: "instruction.fitness", instructionName: "体力" };
  }
}

const areaLabels = {
  attack: "攻撃",
  defense: "守備",
  jump: "跳躍",
  stamina: "スタミナ",
  mental: "メンタル",
} as const;

export function coachRecommendationQuality(
  state: GameState,
): CoachRecommendationQuality {
  const development = state.schools[state.userSchoolId]?.coach.development ?? 0;
  if (development >= 75) return "detailed";
  if (development >= 50) return "standard";
  return "basic";
}

export function coachRecommendationQualityLabel(
  quality: CoachRecommendationQuality,
): string {
  if (quality === "detailed") return "精密提案";
  if (quality === "standard") return "標準提案";
  return "基本提案";
}

export function buildCoachTrainingRecommendation(
  state: GameState,
  player: Player,
): CoachTrainingRecommendation {
  if (player.injury) {
    return {
      playerId: player.id,
      instructionId: "instruction.rest",
      instructionName: "休養",
      reason: "injury",
      reasonLabel: "怪我中のため回復を優先",
    };
  }

  if (player.condition <= 35) {
    return {
      playerId: player.id,
      instructionId: "instruction.rest",
      instructionName: "休養",
      reason: "condition",
      reasonLabel: `調子${player.condition}のため回復を優先`,
    };
  }

  const goal =
    state.teamPlanning.developmentGoalsByPlayerId?.[player.id] ?? null;
  if (goal) {
    const progress = getPlayerDevelopmentGoalProgress(player, goal);
    if (!progress.achieved) {
      const instruction = goalInstruction(progress);
      return {
        playerId: player.id,
        ...instruction,
        reason: "development-goal",
        reasonLabel: `育成目標「${progress.areaLabel} ${progress.targetGrade}」を優先`,
      };
    }
  }

  const quality = coachRecommendationQuality(state);
  if (quality === "basic") {
    return {
      playerId: player.id,
      instructionId: "instruction.overall",
      instructionName: "全体",
      reason: "balanced",
      reasonLabel: "監督の基本方針で基礎をバランス強化",
    };
  }

  const specialty = quality === "detailed" ? specialtyArea(state, player) : null;
  if (specialty) {
    const instruction = areaInstruction(specialty);
    const contract = state.schoolManagement.assistantCoach!;
    return {
      playerId: player.id,
      ...instruction,
      reason: "assistant-specialty",
      reasonLabel: `年間コーチの${contract.specialty === "attack" ? "攻撃" : contract.specialty === "defense" ? "守備" : "フィジカル"}指導を活用`,
    };
  }

  const { weakest } = weakestArea(player);
  const [area, value] = weakest;
  const instruction = areaInstruction(area);
  return {
    playerId: player.id,
    ...instruction,
    reason: "weakness",
    reasonLabel: `弱点「${areaLabels[area]} ${ratingToGrade(value)}」を補強`,
  };
}

export function buildCoachTrainingRecommendations(
  state: GameState,
): CoachTrainingRecommendation[] {
  const school = state.schools[state.userSchoolId];
  if (!school) return [];

  return school.playerIds
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => Boolean(player))
    .map((player) => buildCoachTrainingRecommendation(state, player));
}

export function coachRecommendationInstructionName(
  instructionId: string,
): string {
  return instructionNames[instructionId] ?? "全体";
}
