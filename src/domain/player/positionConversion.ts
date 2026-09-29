import type { GameState } from "../model/GameState";
import type {
  Player,
  Position,
  PositionConversionPlan,
} from "../model/Player";
import type { PlayerId } from "../model/identifiers";

export interface PositionConversionProgress {
  playerId: PlayerId;
  fromPosition: Position;
  targetPosition: Position;
  beforeAptitude: number;
  afterAptitude: number;
  remainingWeeks: number;
  completed: boolean;
}

function baseConversionWeeks(aptitude: number): number {
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
  const base = baseConversionWeeks(player.positionAptitudes[targetPosition]);
  const conversionBonus = player.growthTypeId === "growth.conversion" ? 2 : 0;
  return Math.max(2, base - conversionBonus);
}

export function startPositionConversion(
  state: GameState,
  playerId: PlayerId,
  targetPosition: Position,
): GameState {
  const player = state.players[playerId];
  if (!player || player.career.schoolId !== state.userSchoolId) {
    throw new Error("自校の選手が見つかりません");
  }
  if (targetPosition === player.preferredPosition) {
    throw new Error("現在と同じポジションには転向できません");
  }

  const totalWeeks = positionConversionWeeks(player, targetPosition);
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        positionConversion: {
          fromPosition: player.preferredPosition,
          targetPosition,
          totalWeeks,
          remainingWeeks: totalWeeks,
          startedDate: state.date,
        },
      },
    },
  };
}

export function cancelPositionConversion(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const player = state.players[playerId];
  if (!player || player.career.schoolId !== state.userSchoolId) {
    throw new Error("自校の選手が見つかりません");
  }
  if (!player.positionConversion) return state;

  const nextPlayer = { ...player };
  delete nextPlayer.positionConversion;
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: nextPlayer,
    },
  };
}

function weeklyAptitudeGain(plan: PositionConversionPlan): number {
  return Math.max(4, Math.ceil((72 - 30) / plan.totalWeeks));
}

export function progressPositionConversions(state: GameState): {
  state: GameState;
  progress: PositionConversionProgress[];
} {
  const school = state.schools[state.userSchoolId];
  if (!school) return { state, progress: [] };

  const players = { ...state.players };
  const progress: PositionConversionProgress[] = [];
  let changed = false;

  for (const playerId of school.playerIds) {
    const player = state.players[playerId];
    const plan = player?.positionConversion;
    if (!player || !plan) continue;

    const beforeAptitude = player.positionAptitudes[plan.targetPosition];
    const remainingWeeks = Math.max(0, plan.remainingWeeks - 1);
    const afterAptitude = Math.min(
      100,
      Math.max(
        beforeAptitude,
        beforeAptitude + weeklyAptitudeGain(plan),
        remainingWeeks === 0 ? 72 : 0,
      ),
    );
    const completed = remainingWeeks === 0;

    const nextPlayer: Player = {
      ...player,
      preferredPosition: completed
        ? plan.targetPosition
        : player.preferredPosition,
      positionAptitudes: {
        ...player.positionAptitudes,
        [plan.targetPosition]: afterAptitude,
      },
    };

    if (completed) {
      delete nextPlayer.positionConversion;
    } else {
      nextPlayer.positionConversion = {
        ...plan,
        remainingWeeks,
      };
    }

    players[playerId] = nextPlayer;
    progress.push({
      playerId,
      fromPosition: plan.fromPosition,
      targetPosition: plan.targetPosition,
      beforeAptitude,
      afterAptitude,
      remainingWeeks,
      completed,
    });
    changed = true;
  }

  return {
    state: changed ? { ...state, players } : state,
    progress,
  };
}
