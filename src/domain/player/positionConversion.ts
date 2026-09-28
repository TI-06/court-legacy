import type { GameState } from "../model/GameState";
import type { Player, Position } from "../model/Player";
import type { PlayerId } from "../model/identifiers";

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

function conversionWeeks(player: Player, targetPosition: Position): number {
  const aptitude = player.positionAptitudes[targetPosition] ?? 0;
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
  return Math.max(
    2,
    base - (player.growthTypeId === "growth.conversion" ? 1 : 0),
  );
}

export function startPositionConversion(
  state: GameState,
  playerId: PlayerId,
  targetPosition: Position,
): GameState {
  const player = state.players[playerId];
  if (!player) {
    throw new PositionConversionError(
      "player-not-found",
      "選手が見つかりません",
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

  const totalWeeks = conversionWeeks(player, targetPosition);
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        positionConversion: {
          targetPosition,
          startedDate: state.date,
          totalWeeks,
          remainingWeeks: totalWeeks,
          startingAptitude: player.positionAptitudes[targetPosition] ?? 0,
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

export interface PositionConversionCompletion {
  playerId: PlayerId;
  fromPosition: Position;
  toPosition: Position;
}

export function progressPositionConversions(state: GameState): {
  state: GameState;
  completions: PositionConversionCompletion[];
} {
  let players = state.players;
  let changed = false;
  const completions: PositionConversionCompletion[] = [];

  const school = state.schools[state.userSchoolId];
  const activePlayerIds = new Set(school?.playerIds ?? []);

  for (const player of Object.values(state.players)) {
    const conversion = player.positionConversion;
    if (
      !conversion ||
      player.career.schoolId !== state.userSchoolId ||
      !activePlayerIds.has(player.id)
    ) {
      continue;
    }

    const nextRemaining = Math.max(0, conversion.remainingWeeks - 1);
    const completed = nextRemaining === 0;
    const progressRatio =
      (conversion.totalWeeks - nextRemaining) / conversion.totalWeeks;
    const targetAptitude = completed
      ? Math.max(player.positionAptitudes[conversion.targetPosition], 70)
      : Math.max(
          player.positionAptitudes[conversion.targetPosition],
          Math.round(
            conversion.startingAptitude +
              (70 - conversion.startingAptitude) * progressRatio,
          ),
        );

    const nextPlayer: Player = {
      ...player,
      preferredPosition: completed
        ? conversion.targetPosition
        : player.preferredPosition,
      positionAptitudes: {
        ...player.positionAptitudes,
        [conversion.targetPosition]: Math.min(100, targetAptitude),
      },
    };

    if (completed) {
      delete nextPlayer.positionConversion;
      completions.push({
        playerId: player.id,
        fromPosition: player.preferredPosition,
        toPosition: conversion.targetPosition,
      });
    } else {
      nextPlayer.positionConversion = {
        ...conversion,
        remainingWeeks: nextRemaining,
      };
    }

    if (!changed) players = { ...state.players };
    players[player.id] = nextPlayer;
    changed = true;
  }

  return {
    state: changed ? { ...state, players } : state,
    completions,
  };
}
