import type { GameState } from "../model/GameState";
import type { Player, Position } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { PositionConversionPlan } from "./teamPlanningTypes";

export class PositionConversionError extends Error {
  constructor(
    public readonly code:
      | "player-not-found"
      | "same-position"
      | "already-converting"
      | "conversion-not-found",
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
  return player.growthTypeId === "growth.conversion" ? Math.max(3, base - 1) : base;
}

export function startPositionConversion(
  state: GameState,
  playerId: PlayerId,
  targetPosition: Position,
): GameState {
  const school = state.schools[state.userSchoolId];
  const player = state.players[playerId];
  if (!school?.playerIds.includes(playerId) || !player) {
    throw new PositionConversionError(
      "player-not-found",
      "現在所属している選手だけポジション転向できます",
    );
  }
  if (player.preferredPosition === targetPosition) {
    throw new PositionConversionError(
      "same-position",
      "現在と同じポジションには転向できません",
    );
  }
  const conversions = {
    ...(state.teamPlanning.positionConversionsByPlayerId ?? {}),
  };
  if (conversions[playerId]) {
    throw new PositionConversionError(
      "already-converting",
      "この選手はすでにポジション転向中です",
    );
  }

  const plan: PositionConversionPlan = {
    fromPosition: player.preferredPosition,
    targetPosition,
    weeksRequired: positionConversionWeeks(player, targetPosition),
    weeksCompleted: 0,
    startingAptitude: player.positionAptitudes[targetPosition],
  };
  conversions[playerId] = plan;

  return {
    ...state,
    teamPlanning: {
      ...state.teamPlanning,
      positionConversionsByPlayerId: conversions,
    },
  };
}

export function cancelPositionConversion(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const conversions = {
    ...(state.teamPlanning.positionConversionsByPlayerId ?? {}),
  };
  if (!conversions[playerId]) {
    throw new PositionConversionError(
      "conversion-not-found",
      "進行中のポジション転向がありません",
    );
  }
  delete conversions[playerId];
  return {
    ...state,
    teamPlanning: {
      ...state.teamPlanning,
      positionConversionsByPlayerId: conversions,
    },
  };
}

function nextConversionAptitude(
  plan: PositionConversionPlan,
  completedWeeks: number,
): number {
  const target = Math.max(70, plan.startingAptitude);
  if (completedWeeks >= plan.weeksRequired) return target;
  return Math.min(
    target,
    Math.round(
      plan.startingAptitude +
        ((target - plan.startingAptitude) * completedWeeks) /
          plan.weeksRequired,
    ),
  );
}

export function progressPositionConversions(state: GameState): GameState {
  const current = state.teamPlanning.positionConversionsByPlayerId ?? {};
  const entries = Object.entries(current) as [PlayerId, PositionConversionPlan][];
  if (entries.length === 0) return state;

  const players = { ...state.players };
  const conversions: Partial<Record<PlayerId, PositionConversionPlan>> = {};
  let changed = false;

  for (const [playerId, plan] of entries) {
    const player = players[playerId];
    const school = state.schools[state.userSchoolId];
    if (!player || !school?.playerIds.includes(playerId)) {
      changed = true;
      continue;
    }

    const weeksCompleted = Math.min(plan.weeksRequired, plan.weeksCompleted + 1);
    const aptitude = nextConversionAptitude(plan, weeksCompleted);
    const completed = weeksCompleted >= plan.weeksRequired;
    players[playerId] = {
      ...player,
      preferredPosition: completed ? plan.targetPosition : player.preferredPosition,
      positionAptitudes: {
        ...player.positionAptitudes,
        [plan.targetPosition]: Math.max(
          player.positionAptitudes[plan.targetPosition],
          aptitude,
        ),
      },
    };
    if (!completed) {
      conversions[playerId] = { ...plan, weeksCompleted };
    }
    changed = true;
  }

  if (!changed) return state;
  return {
    ...state,
    players,
    teamPlanning: {
      ...state.teamPlanning,
      positionConversionsByPlayerId: conversions,
    },
  };
}
