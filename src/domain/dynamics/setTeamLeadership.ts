import type { GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";
import {
  calculateCohesionTarget,
  deriveCohesionTrend,
} from "./calculateTeamDynamics";

export type TeamLeadershipErrorCode =
  | "team_leadership_invalid_captain"
  | "team_leadership_invalid_vice_captain"
  | "team_leadership_same_player";

export class TeamLeadershipValidationError extends Error {
  constructor(
    public readonly code: TeamLeadershipErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TeamLeadershipValidationError";
  }
}

function isCurrentUserRosterPlayer(
  state: GameState,
  candidateId: PlayerId,
): boolean {
  const school = state.schools[state.userSchoolId];
  return Boolean(
    school?.playerIds.includes(candidateId) && state.players[candidateId],
  );
}

export function setTeamLeadership(
  state: GameState,
  captainPlayerId: PlayerId,
  viceCaptainPlayerId: PlayerId,
): GameState {
  if (!isCurrentUserRosterPlayer(state, captainPlayerId)) {
    throw new TeamLeadershipValidationError(
      "team_leadership_invalid_captain",
      "主将は現在の自校選手から選んでください",
    );
  }
  if (!isCurrentUserRosterPlayer(state, viceCaptainPlayerId)) {
    throw new TeamLeadershipValidationError(
      "team_leadership_invalid_vice_captain",
      "副主将は現在の自校選手から選んでください",
    );
  }
  if (captainPlayerId === viceCaptainPlayerId) {
    throw new TeamLeadershipValidationError(
      "team_leadership_same_player",
      "主将と副主将には別の選手を選んでください",
    );
  }

  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new TeamLeadershipValidationError(
      "team_leadership_invalid_captain",
      "自校データを確認できません",
    );
  }

  const previousCohesion = state.teamDynamics.cohesion;
  const nextDynamics = {
    ...state.teamDynamics,
    captainPlayerId,
    viceCaptainPlayerId,
  };
  const nextState: GameState = {
    ...state,
    schools: {
      ...state.schools,
      [state.userSchoolId]: {
        ...school,
        captainPlayerId,
      },
    },
    teamDynamics: nextDynamics,
  };
  const cohesion = calculateCohesionTarget(nextState, nextDynamics);

  return {
    ...nextState,
    teamDynamics: {
      ...nextDynamics,
      previousCohesion,
      cohesion,
      cohesionTrend: deriveCohesionTrend(previousCohesion, cohesion),
    },
  };
}
