import type { GameState } from "../model/GameState";
import type { Player, Position } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { PlayerPositionConversion } from "./teamPlanningTypes";

export const POSITION_CONVERSION_TARGET_APTITUDE = 70;

function conversionWeeksForAptitude(
  aptitude: number,
  growthTypeId: string,
): number {
  const normalized = Math.max(0, Math.min(100, Math.round(aptitude)));
  let weeks =
    normalized >= 70
      ? 3
      : normalized >= 60
        ? 4
        : normalized >= 50
          ? 5
          : normalized >= 40
            ? 6
            : normalized >= 30
              ? 7
              : 8;
  if (growthTypeId === "growth.conversion") {
    weeks = Math.max(2, weeks - 1);
  }
  return weeks;
}

export function buildPositionConversion(
  state: GameState,
  playerId: PlayerId,
  targetPosition: Position,
): PlayerPositionConversion {
  const school = state.schools[state.userSchoolId];
  const player = state.players[playerId];
  if (!school?.playerIds.includes(playerId) || !player) {
    throw new Error("現在所属している選手だけコンバートできます");
  }
  if (player.preferredPosition === targetPosition) {
    throw new Error("現在と同じポジションにはコンバートできません");
  }

  const startingAptitude = Math.round(player.positionAptitudes[targetPosition]);
  return {
    fromPosition: player.preferredPosition,
    targetPosition,
    startedWeekOfYear: state.calendar.weekOfYear,
    startedAcademicYearIndex: state.yearIndex,
    totalWeeks: conversionWeeksForAptitude(
      startingAptitude,
      player.growthTypeId,
    ),
    completedWeeks: 0,
    startingAptitude,
  };
}

export function startPositionConversion(
  state: GameState,
  playerId: PlayerId,
  targetPosition: Position,
): GameState {
  const conversion = buildPositionConversion(state, playerId, targetPosition);
  return {
    ...state,
    teamPlanning: {
      ...state.teamPlanning,
      positionConversionsByPlayerId: {
        ...(state.teamPlanning.positionConversionsByPlayerId ?? {}),
        [playerId]: conversion,
      },
    },
  };
}

export function cancelPositionConversion(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const current = state.teamPlanning.positionConversionsByPlayerId ?? {};
  if (!current[playerId]) return state;
  const next = { ...current };
  delete next[playerId];
  return {
    ...state,
    teamPlanning: {
      ...state.teamPlanning,
      positionConversionsByPlayerId: next,
    },
  };
}

function progressPlayerAptitude(
  player: Player,
  conversion: PlayerPositionConversion,
  nextCompletedWeeks: number,
): Player {
  const target = conversion.targetPosition;
  const current = player.positionAptitudes[target];
  const targetAtCompletion = Math.max(
    POSITION_CONVERSION_TARGET_APTITUDE,
    conversion.startingAptitude,
  );
  const planned = Math.round(
    conversion.startingAptitude +
      ((targetAtCompletion - conversion.startingAptitude) *
        nextCompletedWeeks) /
        conversion.totalWeeks,
  );
  const nextAptitude = Math.max(current, Math.min(100, planned));

  return {
    ...player,
    positionAptitudes: {
      ...player.positionAptitudes,
      [target]: nextAptitude,
    },
  };
}

export interface PositionConversionCompletion {
  playerId: PlayerId;
  fromPosition: Position;
  targetPosition: Position;
  finalAptitude: number;
}

export interface PositionConversionProgressResult {
  state: GameState;
  completions: PositionConversionCompletion[];
}

export function progressPositionConversions(
  state: GameState,
): PositionConversionProgressResult {
  const conversions = state.teamPlanning.positionConversionsByPlayerId ?? {};
  const entries = Object.entries(conversions) as Array<
    [PlayerId, PlayerPositionConversion | undefined]
  >;
  if (entries.length === 0) {
    return { state, completions: [] };
  }

  let players = state.players;
  const nextConversions = { ...conversions };
  const completions: PositionConversionCompletion[] = [];
  let changed = false;

  for (const [playerId, conversion] of entries) {
    if (!conversion) continue;
    const player = players[playerId];
    const school = state.schools[state.userSchoolId];
    if (!player || !school?.playerIds.includes(playerId)) {
      delete nextConversions[playerId];
      changed = true;
      continue;
    }

    const nextCompletedWeeks = Math.min(
      conversion.totalWeeks,
      conversion.completedWeeks + 1,
    );
    const progressedPlayer = progressPlayerAptitude(
      player,
      conversion,
      nextCompletedWeeks,
    );
    if (players === state.players) players = { ...state.players };

    if (nextCompletedWeeks >= conversion.totalWeeks) {
      const completedPlayer: Player = {
        ...progressedPlayer,
        preferredPosition: conversion.targetPosition,
      };
      players[playerId] = completedPlayer;
      delete nextConversions[playerId];
      completions.push({
        playerId,
        fromPosition: conversion.fromPosition,
        targetPosition: conversion.targetPosition,
        finalAptitude:
          completedPlayer.positionAptitudes[conversion.targetPosition],
      });
    } else {
      players[playerId] = progressedPlayer;
      nextConversions[playerId] = {
        ...conversion,
        completedWeeks: nextCompletedWeeks,
      };
    }
    changed = true;
  }

  if (!changed) return { state, completions };

  return {
    state: {
      ...state,
      players,
      teamPlanning: {
        ...state.teamPlanning,
        positionConversionsByPlayerId: nextConversions,
      },
    },
    completions,
  };
}
