import type { GameState } from "../model/GameState";
import type { Player, Position } from "../model/Player";
import type { PlayerId } from "../model/identifiers";

export interface PositionConversionCompletion {
  playerId: PlayerId;
  fromPosition: Position;
  targetPosition: Position;
}

export interface PositionConversionProgressResult {
  state: GameState;
  completed: PositionConversionCompletion[];
}

export class PositionConversionError extends Error {
  constructor(
    public readonly code:
      "player-not-found" | "same-position" | "already-converting",
    message: string,
  ) {
    super(message);
    this.name = "PositionConversionError";
  }
}

export function positionConversionWeeks(
  player: Player,
  targetPosition: Position,
): number {
  const aptitude = player.positionAptitudes[targetPosition];
  const baseWeeks =
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
  return Math.max(
    2,
    baseWeeks - (player.growthTypeId === "growth.conversion" ? 1 : 0),
  );
}

export function startPositionConversion(
  state: GameState,
  playerId: PlayerId,
  targetPosition: Position,
): GameState {
  const player = state.players[playerId];
  const school = state.schools[state.userSchoolId];
  if (!player || !school?.playerIds.includes(playerId)) {
    throw new PositionConversionError(
      "player-not-found",
      "自校の選手を確認できません",
    );
  }
  if (player.preferredPosition === targetPosition) {
    throw new PositionConversionError(
      "same-position",
      "現在と同じポジションには転向できません",
    );
  }
  if (player.positionConversion) {
    throw new PositionConversionError(
      "already-converting",
      "この選手はすでにポジション転向中です",
    );
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
  const school = state.schools[state.userSchoolId];
  if (!player || !school?.playerIds.includes(playerId)) {
    throw new PositionConversionError(
      "player-not-found",
      "自校の選手を確認できません",
    );
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

export function progressPositionConversions(
  state: GameState,
): PositionConversionProgressResult {
  const school = state.schools[state.userSchoolId];
  if (!school) return { state, completed: [] };

  let players = state.players;
  let changed = false;
  const completed: PositionConversionCompletion[] = [];

  for (const playerId of school.playerIds) {
    const player = state.players[playerId];
    const progress = player?.positionConversion;
    if (!player || !progress) continue;

    if (!changed) {
      players = { ...state.players };
      changed = true;
    }

    const target = progress.targetPosition;
    const currentAptitude = player.positionAptitudes[target];
    const aptitudeGain = Math.max(
      2,
      Math.ceil((70 - currentAptitude) / Math.max(1, progress.remainingWeeks)),
    );
    const nextAptitude = Math.min(
      100,
      Math.max(currentAptitude, currentAptitude + aptitudeGain),
    );
    const remainingWeeks = Math.max(0, progress.remainingWeeks - 1);

    if (remainingWeeks === 0) {
      const completedPlayer = { ...player };
      delete completedPlayer.positionConversion;
      players[playerId] = {
        ...completedPlayer,
        preferredPosition: target,
        positionAptitudes: {
          ...completedPlayer.positionAptitudes,
          [target]: Math.max(70, nextAptitude),
        },
      };
      completed.push({
        playerId,
        fromPosition: progress.fromPosition,
        targetPosition: target,
      });
      continue;
    }

    players[playerId] = {
      ...player,
      positionAptitudes: {
        ...player.positionAptitudes,
        [target]: nextAptitude,
      },
      positionConversion: {
        ...progress,
        remainingWeeks,
      },
    };
  }

  return {
    state: changed ? { ...state, players } : state,
    completed,
  };
}
