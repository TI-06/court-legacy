import type { GameState } from "../model/GameState";
import type { Player, Position } from "../model/Player";
import type { PlayerId } from "../model/identifiers";

export interface PositionConversionPlan {
  targetPosition: Position;
  totalWeeks: number;
  remainingWeeks: number;
  startedDate: string;
  startingAptitude: number;
}

function baseWeeks(aptitude: number): number {
  if (aptitude >= 70) return 3;
  if (aptitude >= 60) return 4;
  if (aptitude >= 50) return 5;
  if (aptitude >= 40) return 6;
  if (aptitude >= 30) return 7;
  return 8;
}

export function positionConversionWeeks(
  player: Player,
  targetPosition: Position,
): number {
  const aptitude = player.positionAptitudes[targetPosition];
  const weeks = baseWeeks(aptitude);
  return player.growthTypeId === "growth.conversion"
    ? Math.max(3, weeks - 1)
    : weeks;
}

export function startPositionConversion(
  state: GameState,
  playerId: PlayerId,
  targetPosition: Position,
): GameState {
  const player = state.players[playerId];
  if (!player || player.career.schoolId !== state.userSchoolId) {
    throw new Error("自校の選手を指定してください");
  }
  if (player.preferredPosition === targetPosition) {
    throw new Error("現在と同じポジションには転向できません");
  }

  const totalWeeks = positionConversionWeeks(player, targetPosition);
  const positionConversion: PositionConversionPlan = {
    targetPosition,
    totalWeeks,
    remainingWeeks: totalWeeks,
    startedDate: state.date,
    startingAptitude: player.positionAptitudes[targetPosition],
  };

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        positionConversion,
      },
    },
  };
}

function weeklyAptitudeGain(plan: PositionConversionPlan): number {
  const targetAptitude = Math.max(70, plan.startingAptitude);
  const needed = Math.max(0, targetAptitude - plan.startingAptitude);
  return Math.max(1, Math.ceil(needed / plan.totalWeeks));
}

export interface PositionConversionProgress {
  playerId: PlayerId;
  completed: boolean;
  targetPosition: Position;
  remainingWeeks: number;
}

export function progressPositionConversions(state: GameState): {
  state: GameState;
  progress: PositionConversionProgress[];
} {
  const school = state.schools[state.userSchoolId];
  if (!school) return { state, progress: [] };

  let players = state.players;
  let changed = false;
  const progress: PositionConversionProgress[] = [];

  for (const playerId of school.playerIds) {
    const player = state.players[playerId];
    const plan = player?.positionConversion;
    if (!player || !plan) continue;

    const remainingWeeks = Math.max(0, plan.remainingWeeks - 1);
    const aptitudeGain = weeklyAptitudeGain(plan);
    const nextAptitude = Math.min(
      100,
      player.positionAptitudes[plan.targetPosition] + aptitudeGain,
    );
    const completed = remainingWeeks === 0;

    players = {
      ...players,
      [playerId]: {
        ...player,
        preferredPosition: completed
          ? plan.targetPosition
          : player.preferredPosition,
        positionAptitudes: {
          ...player.positionAptitudes,
          [plan.targetPosition]: completed
            ? Math.max(70, nextAptitude)
            : nextAptitude,
        },
        positionConversion: completed
          ? undefined
          : {
              ...plan,
              remainingWeeks,
            },
      },
    };
    changed = true;
    progress.push({
      playerId,
      completed,
      targetPosition: plan.targetPosition,
      remainingWeeks,
    });
  }

  return { state: changed ? { ...state, players } : state, progress };
}
