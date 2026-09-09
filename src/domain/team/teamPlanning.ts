import type { GameState } from "../model/GameState";
import type { TeamSelection } from "../model/TeamSelection";
import type { PlayerId } from "../model/identifiers";
import type {
  SavedLineupSlot,
  TeamPlanningState,
} from "./teamPlanningTypes";
import { validateTeamSelection } from "./validateTeamSelection";

export type TeamPlanningValidationCode =
  | "invalid-development-priorities"
  | "invalid-saved-lineup-name"
  | "invalid-saved-lineup";

export class TeamPlanningValidationError extends Error {
  constructor(
    public readonly code: TeamPlanningValidationCode,
    message: string,
  ) {
    super(message);
    this.name = "TeamPlanningValidationError";
  }
}

export function createDefaultTeamPlanning(): TeamPlanningState {
  return {
    developmentPriorityPlayerIds: [],
    savedLineups: [],
  };
}

function cloneTeamSelection(selection: TeamSelection): TeamSelection {
  return {
    rotation: selection.rotation.map((assignment) => ({ ...assignment })),
    liberoPlayerId: selection.liberoPlayerId,
    benchPlayerIds: [...selection.benchPlayerIds],
    servingOrderPlayerIds: [...selection.servingOrderPlayerIds],
    substitutionPolicy: {
      ...selection.substitutionPolicy,
      starterLockPlayerIds: [
        ...selection.substitutionPolicy.starterLockPlayerIds,
      ],
    },
  };
}

export function setDevelopmentPriorities(
  state: GameState,
  playerIds: readonly PlayerId[],
): GameState {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new TeamPlanningValidationError(
      "invalid-development-priorities",
      "所属校が見つかりません",
    );
  }

  if (playerIds.length > 3 || new Set(playerIds).size !== playerIds.length) {
    throw new TeamPlanningValidationError(
      "invalid-development-priorities",
      "重点育成は重複なしで3人まで選択してください",
    );
  }

  const roster = new Set(school.playerIds);
  if (playerIds.some((playerId) => !roster.has(playerId))) {
    throw new TeamPlanningValidationError(
      "invalid-development-priorities",
      "重点育成には現在所属している選手だけを選択できます",
    );
  }

  return {
    ...state,
    teamPlanning: {
      ...state.teamPlanning,
      developmentPriorityPlayerIds: [...playerIds],
    },
  };
}

export interface SaveLineupPresetInput {
  slot: SavedLineupSlot;
  name: string;
  selection: TeamSelection;
}

export function saveLineupPreset(
  state: GameState,
  input: SaveLineupPresetInput,
): GameState {
  const name = input.name.trim();
  if (name.length === 0 || name.length > 24) {
    throw new TeamPlanningValidationError(
      "invalid-saved-lineup-name",
      "保存編成名は1〜24文字で入力してください",
    );
  }

  const issues = validateTeamSelection({
    state,
    schoolId: state.userSchoolId,
    selection: input.selection,
  });
  if (issues.length > 0) {
    throw new TeamPlanningValidationError(
      "invalid-saved-lineup",
      issues[0]!.message,
    );
  }

  const preset = {
    slot: input.slot,
    name,
    selection: cloneTeamSelection(input.selection),
  };
  const savedLineups = state.teamPlanning.savedLineups
    .filter((candidate) => candidate.slot !== input.slot)
    .concat(preset)
    .sort((left, right) => left.slot - right.slot);

  return {
    ...state,
    teamPlanning: {
      ...state.teamPlanning,
      savedLineups,
    },
  };
}

export function deleteLineupPreset(
  state: GameState,
  slot: SavedLineupSlot,
): GameState {
  if (!state.teamPlanning.savedLineups.some((preset) => preset.slot === slot)) {
    return state;
  }

  return {
    ...state,
    teamPlanning: {
      ...state.teamPlanning,
      savedLineups: state.teamPlanning.savedLineups.filter(
        (preset) => preset.slot !== slot,
      ),
    },
  };
}
