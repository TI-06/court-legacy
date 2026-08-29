import type { GameState } from "../model/GameState";
import type { MatchState } from "../model/Match";
import type { PlayerId, SchoolId } from "../model/identifiers";
import type { TeamSelection } from "../model/TeamSelection";
import {
  calculateCohesionTarget,
  deriveCohesionTrend,
} from "./calculateTeamDynamics";
import {
  calculateLineupContinuity,
  derivePlayerConcerns,
  derivePlayerRoles,
  updateRecentOfficialUsage,
} from "./derivePlayerDynamics";

const WIN_MORALE_CHANGE = 2;
const WIN_TRUST_CHANGE = 1;
const LOSS_MORALE_CHANGE = -2;
const LOSS_TRUST_CHANGE = -1;

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampReadiness(value: number): number {
  return Math.max(0.95, Math.min(1.05, value));
}

function userRosterIds(state: GameState): readonly PlayerId[] {
  return state.schools[state.userSchoolId]?.playerIds ?? [];
}

function userSelectionFromMatch(
  state: GameState,
  match: MatchState,
): TeamSelection {
  if (match.homeSchoolId === state.userSchoolId) {
    return match.homeSelection;
  }
  if (match.awaySchoolId === state.userSchoolId) {
    return match.awaySelection;
  }
  throw new Error("official match dynamics require the user school");
}

function starterIds(selection: TeamSelection): PlayerId[] {
  const ids = selection.rotation.map((assignment) => assignment.playerId);
  if (selection.liberoPlayerId) {
    ids.push(selection.liberoPlayerId);
  }
  return [...new Set(ids)];
}

export function calculatePveDynamicsReadiness(
  state: GameState,
  schoolId: SchoolId,
  playerId: PlayerId,
): number {
  if (schoolId !== state.userSchoolId) {
    return 1;
  }
  const school = state.schools[state.userSchoolId];
  const player = state.players[playerId];
  if (!school || !player || !school.playerIds.includes(playerId)) {
    return 1;
  }

  const cohesionSignal = ((state.teamDynamics.cohesion - 50) / 50) * 0.02;
  const moraleSignal = ((player.morale - 50) / 50) * 0.015;
  const trustSignal = ((player.trust - 50) / 50) * 0.015;

  return Number(
    clampReadiness(1 + cohesionSignal + moraleSignal + trustSignal).toFixed(4),
  );
}

export function buildPveDynamicsReadinessByPlayerId(
  state: GameState,
): Partial<Record<PlayerId, number>> {
  const readiness: Partial<Record<PlayerId, number>> = {};
  for (const playerId of userRosterIds(state)) {
    readiness[playerId] = calculatePveDynamicsReadiness(
      state,
      state.userSchoolId,
      playerId,
    );
  }
  return readiness;
}

export interface ApplyOfficialMatchDynamicsFeedbackInput {
  state: GameState;
  match: MatchState;
  won: boolean;
}

export function applyOfficialMatchDynamicsFeedback({
  state,
  match,
  won,
}: ApplyOfficialMatchDynamicsFeedbackInput): GameState {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    return state;
  }

  const selection = userSelectionFromMatch(state, match);
  const currentStarterIds = starterIds(selection);
  const usage = updateRecentOfficialUsage(
    state.teamDynamics,
    currentStarterIds,
  );
  const players = { ...state.players };
  const moraleChange = won ? WIN_MORALE_CHANGE : LOSS_MORALE_CHANGE;
  const trustChange = won ? WIN_TRUST_CHANGE : LOSS_TRUST_CHANGE;

  for (const playerId of school.playerIds) {
    const player = state.players[playerId];
    if (!player) {
      continue;
    }
    players[playerId] = {
      ...player,
      morale: clamp100(player.morale + moraleChange),
      trust: clamp100(player.trust + trustChange),
    };
  }

  const stateWithPlayers: GameState = {
    ...state,
    players,
  };
  const playerRoles = derivePlayerRoles({
    state: stateWithPlayers,
    selection,
    dynamics: usage,
  });
  const lineupContinuity = calculateLineupContinuity(
    usage,
    currentStarterIds,
  );
  const dynamicsWithUsage = {
    ...usage,
    playerRoles,
    lineupContinuity,
  };
  const playerConcerns = derivePlayerConcerns(
    stateWithPlayers,
    playerRoles,
    dynamicsWithUsage,
  );
  const nextDynamics = {
    ...dynamicsWithUsage,
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
