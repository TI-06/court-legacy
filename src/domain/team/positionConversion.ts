import type { GameState } from "../model/GameState";
import type { Position } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { PlayerPositionConversion } from "./teamPlanningTypes";

const MIN_CONVERSION_WEEKS = 4;
const FAST_CONVERSION_WEEKS = 3;
const MAX_CONVERSION_WEEKS = 10;
const TARGET_APTITUDE = 70;

function clampWeeks(value: number): number {
  return Math.max(MIN_CONVERSION_WEEKS, Math.min(MAX_CONVERSION_WEEKS, value));
}

export function positionConversionRequiredWeeks(
  targetAptitude: number,
  growthTypeId?: string,
): number {
  const gap = Math.max(0, TARGET_APTITUDE - Math.round(targetAptitude));
  const baseWeeks = clampWeeks(Math.ceil(gap / 6));
  return growthTypeId === "growth.conversion"
    ? Math.max(FAST_CONVERSION_WEEKS, baseWeeks - 1)
    : baseWeeks;
}

export function startPlayerPositionConversion(
  state: GameState,
  playerId: PlayerId,
  targetPosition: Position,
): GameState {
  const school = state.schools[state.userSchoolId];
  const player = state.players[playerId];
  if (!school || !player || !school.playerIds.includes(playerId)) {
    throw new Error("コンバートできるのは現在所属している選手だけです");
  }
  if (player.preferredPosition === targetPosition) {
    throw new Error("現在の本職と同じポジションにはコンバートできません");
  }

  const current =
    state.teamPlanning.positionConversionsByPlayerId?.[playerId] ?? null;
  if (current?.targetPosition === targetPosition) return state;

  const conversion: PlayerPositionConversion = {
    fromPosition: player.preferredPosition,
    targetPosition,
    completedWeeks: 0,
    requiredWeeks: positionConversionRequiredWeeks(
      player.positionAptitudes[targetPosition],
      player.growthTypeId,
    ),
  };

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

export function cancelPlayerPositionConversion(
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

export interface PositionConversionProgress {
  state: GameState;
  progressedPlayerIds: PlayerId[];
  completedPlayerIds: PlayerId[];
}

export function progressPositionConversions(
  state: GameState,
  trainedPlayerIds: ReadonlySet<PlayerId>,
): PositionConversionProgress {
  const school = state.schools[state.userSchoolId];
  const current = state.teamPlanning.positionConversionsByPlayerId ?? {};
  if (!school || Object.keys(current).length === 0) {
    return { state, progressedPlayerIds: [], completedPlayerIds: [] };
  }

  const roster = new Set(school.playerIds);
  const conversions = { ...current };
  let players = state.players;
  let changed = false;
  const progressedPlayerIds: PlayerId[] = [];
  const completedPlayerIds: PlayerId[] = [];

  for (const [rawPlayerId, conversion] of Object.entries(current) as [
    PlayerId,
    PlayerPositionConversion | undefined,
  ][]) {
    if (!conversion) continue;
    const playerId = rawPlayerId as PlayerId;
    const player = state.players[playerId];

    if (!player || !roster.has(playerId)) {
      delete conversions[playerId];
      changed = true;
      continue;
    }
    if (!trainedPlayerIds.has(playerId)) continue;

    const completedWeeks = Math.min(
      conversion.requiredWeeks,
      conversion.completedWeeks + 1,
    );
    const remainingWeeks = Math.max(
      1,
      conversion.requiredWeeks - conversion.completedWeeks,
    );
    const currentAptitude = player.positionAptitudes[conversion.targetPosition];
    const weeklyAptitudeGain = Math.max(
      1,
      Math.ceil((TARGET_APTITUDE - currentAptitude) / remainingWeeks),
    );
    const nextAptitude = Math.min(
      TARGET_APTITUDE,
      currentAptitude + weeklyAptitudeGain,
    );
    const completed = completedWeeks >= conversion.requiredWeeks;

    if (players === state.players) players = { ...state.players };
    players[playerId] = {
      ...player,
      preferredPosition: completed
        ? conversion.targetPosition
        : player.preferredPosition,
      positionAptitudes: {
        ...player.positionAptitudes,
        [conversion.targetPosition]: Math.max(currentAptitude, nextAptitude),
      },
    };
    progressedPlayerIds.push(playerId);
    changed = true;

    if (completed) {
      delete conversions[playerId];
      completedPlayerIds.push(playerId);
    } else {
      conversions[playerId] = {
        ...conversion,
        completedWeeks,
      };
    }
  }

  if (!changed) {
    return { state, progressedPlayerIds, completedPlayerIds };
  }

  return {
    state: {
      ...state,
      players,
      teamPlanning: {
        ...state.teamPlanning,
        positionConversionsByPlayerId: conversions,
      },
    },
    progressedPlayerIds,
    completedPlayerIds,
  };
}
