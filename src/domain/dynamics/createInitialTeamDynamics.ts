import type { GameState } from "../model/GameState";
import { calculateCohesionTarget } from "./calculateTeamDynamics";
import type { TeamDynamicsState } from "./teamDynamicsTypes";

export type InitialTeamDynamicsSource = Pick<
  GameState,
  "userSchoolId" | "schools" | "players" | "playerRelationships"
>;

export function createInitialTeamDynamics(
  state: InitialTeamDynamicsSource,
): TeamDynamicsState {
  const school = state.schools[state.userSchoolId];
  const captainPlayerId =
    school?.captainPlayerId &&
    school.playerIds.includes(school.captainPlayerId) &&
    Boolean(state.players[school.captainPlayerId])
      ? school.captainPlayerId
      : null;
  const base: TeamDynamicsState = {
    captainPlayerId,
    viceCaptainPlayerId: null,
    cohesion: 50,
    previousCohesion: 50,
    cohesionTrend: "stable",
    playerRoles: {},
    playerConcerns: {},
    lineupContinuity: 50,
    recentOfficialStarterCounts: {},
    recentOfficialMatchesTracked: 0,
  };
  const cohesion = calculateCohesionTarget(state, base);

  return {
    ...base,
    cohesion,
    previousCohesion: cohesion,
  };
}
