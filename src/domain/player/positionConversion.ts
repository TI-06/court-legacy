import type { GameState } from "../model/GameState";
import type {
  Player,
  Position,
  PositionConversionPlan,
} from "../model/Player";
import type { PlayerId } from "../model/identifiers";

export interface PositionConversionCompletion {
  playerId: PlayerId;
  fromPosition: Position;
  targetPosition: Position;
}

export function positionConversionWeeks(
  player: Player,
  targetPosition: Position,
): number {
  const aptitude = player.positionAptitudes[targetPosition];
  const base =
    aptitude >= 70
      ? 3
      : aptitude >= 60
        ? 4
        : aptitude >= 50
          ? 5
          : aptitude >= 40
            ? 6
            : aptitude >= 30
              ? 7
              : 8;
  return player.growthTypeId === "growth.conversion"
    ? Math.max(3, base - 1)
    : base;
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

  const weeksTotal = positionConversionWeeks(player, targetPosition);
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        positionConversion: {
          fromPosition: player.preferredPosition,
          targetPosition,
          startingAptitude: player.positionAptitudes[targetPosition],
          weeksTotal,
          weeksRemaining: weeksTotal,
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
  if (!player?.positionConversion) return state;
  const next = { ...player };
  delete next.positionConversion;
  return {
    ...state,
    players: { ...state.players, [playerId]: next },
  };
}

export function progressPositionConversions(state: GameState): {
  state: GameState;
  completions: PositionConversionCompletion[];
} {
  let changed = false;
  const completions: PositionConversionCompletion[] = [];
  const players = { ...state.players };

  for (const playerId of state.schools[state.userSchoolId]?.playerIds ?? []) {
    const player = state.players[playerId];
    const plan = player?.positionConversion;
    if (!player || !plan) continue;

    const weeksRemaining = Math.max(0, plan.weeksRemaining - 1);
    const elapsed = plan.weeksTotal - weeksRemaining;
    const targetGain = Math.max(0, 70 - plan.startingAptitude);
    const aptitude = Math.min(
      100,
      Math.max(
        player.positionAptitudes[plan.targetPosition],
        plan.startingAptitude +
          Math.round((targetGain * elapsed) / plan.weeksTotal),
      ),
    );

    const positionAptitudes = {
      ...player.positionAptitudes,
      [plan.targetPosition]: aptitude,
    };

    if (weeksRemaining === 0) {
      const next = {
        ...player,
        preferredPosition: plan.targetPosition,
        positionAptitudes: {
          ...positionAptitudes,
          [plan.targetPosition]: Math.max(70, aptitude),
        },
      };
      delete next.positionConversion;
      players[playerId] = next;
      completions.push({
        playerId,
        fromPosition: plan.fromPosition,
        targetPosition: plan.targetPosition,
      });
    } else {
      players[playerId] = {
        ...player,
        positionAptitudes,
        positionConversion: { ...plan, weeksRemaining },
      };
    }
    changed = true;
  }

  return {
    state: changed ? { ...state, players } : state,
    completions,
  };
}
