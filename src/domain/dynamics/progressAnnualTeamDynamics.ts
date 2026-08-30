import type { GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";
import { autoSelectTeam } from "../team/autoSelectTeam";
import {
  calculateCohesionTarget,
  deriveCohesionTrend,
} from "./calculateTeamDynamics";
import {
  calculateLineupContinuity,
  derivePlayerConcerns,
  derivePlayerRoles,
} from "./derivePlayerDynamics";
import type { TeamDynamicsState } from "./teamDynamicsTypes";

function activeLeadershipId(
  state: GameState,
  playerId: PlayerId | null,
): PlayerId | null {
  if (!playerId) {
    return null;
  }
  const school = state.schools[state.userSchoolId];
  return school?.playerIds.includes(playerId) &&
    Boolean(state.players[playerId])
    ? playerId
    : null;
}

export function progressAnnualTeamDynamics(
  state: GameState,
  previousDynamics: TeamDynamicsState,
): GameState {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    return state;
  }

  const captainPlayerId = activeLeadershipId(
    state,
    previousDynamics.captainPlayerId,
  );
  const viceCaptainPlayerId = activeLeadershipId(
    state,
    previousDynamics.viceCaptainPlayerId,
  );
  const stateWithLeadership: GameState = {
    ...state,
    schools: {
      ...state.schools,
      [school.id]: {
        ...school,
        captainPlayerId,
      },
    },
  };
  const selection = autoSelectTeam({
    state: stateWithLeadership,
    schoolId: state.userSchoolId,
  });
  const baseDynamics: TeamDynamicsState = {
    ...previousDynamics,
    captainPlayerId,
    viceCaptainPlayerId,
    playerRoles: {},
    playerConcerns: {},
    lineupContinuity: 50,
    recentOfficialStarterCounts: {},
    recentOfficialMatchesTracked: 0,
  };
  const playerRoles = derivePlayerRoles({
    state: stateWithLeadership,
    selection,
    dynamics: baseDynamics,
  });
  const starterIds = selection.rotation.map(
    (assignment) => assignment.playerId,
  );
  if (selection.liberoPlayerId) {
    starterIds.push(selection.liberoPlayerId);
  }
  const lineupContinuity = calculateLineupContinuity(baseDynamics, starterIds);
  const dynamicsWithRoles: TeamDynamicsState = {
    ...baseDynamics,
    playerRoles,
    lineupContinuity,
  };
  const playerConcerns = derivePlayerConcerns(
    stateWithLeadership,
    playerRoles,
    dynamicsWithRoles,
  );
  const dynamicsWithConcerns: TeamDynamicsState = {
    ...dynamicsWithRoles,
    playerConcerns,
  };
  const previousCohesion = previousDynamics.cohesion;
  const cohesion = calculateCohesionTarget(
    stateWithLeadership,
    dynamicsWithConcerns,
  );

  return {
    ...stateWithLeadership,
    teamDynamics: {
      ...dynamicsWithConcerns,
      previousCohesion,
      cohesion,
      cohesionTrend: deriveCohesionTrend(previousCohesion, cohesion),
    },
  };
}
