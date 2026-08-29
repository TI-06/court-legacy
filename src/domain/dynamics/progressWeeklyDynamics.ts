import type { GameState } from "../model/GameState";
import type { Player } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { AdditionalGrowthModifier } from "../training/calculateGrowth";
import {
  calculateCohesionTarget,
  deriveCohesionTrend,
} from "./calculateTeamDynamics";
import { derivePlayerConcerns } from "./derivePlayerDynamics";

const MAX_WEEKLY_CONCERN_PENALTY = 4;

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function recoverTowardNeutral(value: number): number {
  if (value < 50) {
    return clamp100(value + 1);
  }
  if (value > 50) {
    return clamp100(value - 1);
  }
  return 50;
}

function concernPenalty(state: GameState, playerId: PlayerId): number {
  const concerns = state.teamDynamics.playerConcerns[playerId] ?? [];
  return Math.min(
    MAX_WEEKLY_CONCERN_PENALTY,
    concerns.reduce((sum, concern) => sum + concern.severity, 0),
  );
}

function progressPlayer(state: GameState, player: Player): Player {
  const penalty = concernPenalty(state, player.id);
  if (penalty === 0) {
    return {
      ...player,
      morale: recoverTowardNeutral(player.morale),
      trust: recoverTowardNeutral(player.trust),
    };
  }

  return {
    ...player,
    morale: clamp100(player.morale - penalty),
    trust: clamp100(player.trust - penalty),
  };
}

function dynamicsModifierPercent(value: number): number {
  return Math.max(
    95,
    Math.min(105, Math.round(100 + (clamp100(value) - 50) / 10)),
  );
}

export function calculateDynamicsTrainingModifiers(
  player: Pick<Player, "morale" | "trust">,
): AdditionalGrowthModifier[] {
  return [
    {
      code: "morale",
      label: "士気",
      percent: dynamicsModifierPercent(player.morale),
    },
    {
      code: "trust",
      label: "信頼",
      percent: dynamicsModifierPercent(player.trust),
    },
  ];
}

export function progressWeeklyDynamics(state: GameState): GameState {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    return state;
  }

  const players = { ...state.players };
  for (const playerId of school.playerIds) {
    const player = state.players[playerId];
    if (player) {
      players[playerId] = progressPlayer(state, player);
    }
  }

  const stateWithPlayers: GameState = {
    ...state,
    players,
  };
  const playerConcerns = derivePlayerConcerns(
    stateWithPlayers,
    state.teamDynamics.playerRoles,
    state.teamDynamics,
  );
  const nextDynamics = {
    ...state.teamDynamics,
    playerConcerns,
  };
  const previousCohesion = state.teamDynamics.cohesion;
  const cohesion = calculateCohesionTarget(stateWithPlayers, nextDynamics);

  return {
    ...stateWithPlayers,
    teamDynamics: {
      ...nextDynamics,
      previousCohesion,
      cohesion,
      cohesionTrend: deriveCohesionTrend(previousCohesion, cohesion),
    },
  };
}
