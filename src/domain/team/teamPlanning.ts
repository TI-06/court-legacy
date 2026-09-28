import type { GameState } from "../model/GameState";
import type { Position } from "../model/Player";
import type { TeamSelection } from "../model/TeamSelection";
import type { PlayerId } from "../model/identifiers";
import type {
  PlayerDevelopmentGoal,
  PositionConversionPlan,
  SavedLineupSlot,
  TeamPlanningState,
} from "./teamPlanningTypes";
import { validateTeamSelection } from "./validateTeamSelection";

export type TeamPlanningValidationCode =
  | "invalid-development-priorities"
  | "invalid-development-goal"
  | "invalid-position-conversion"
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
    developmentGoalsByPlayerId: {},
    positionConversionsByPlayerId: {},
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

export function setPlayerDevelopmentGoal(
  state: GameState,
  playerId: PlayerId,
  goal: PlayerDevelopmentGoal | null,
): GameState {
  const school = state.schools[state.userSchoolId];
  if (!school || !school.playerIds.includes(playerId)) {
    throw new TeamPlanningValidationError(
      "invalid-development-goal",
      "育成目標には現在所属している選手だけを選択できます",
    );
  }

  const current = { ...(state.teamPlanning.developmentGoalsByPlayerId ?? {}) };
  if (goal) {
    current[playerId] = { ...goal };
  } else {
    delete current[playerId];
  }

  return {
    ...state,
    teamPlanning: {
      ...state.teamPlanning,
      developmentGoalsByPlayerId: current,
    },
  };
}

function conversionWeeks(aptitude: number, growthTypeId: string): number {
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
  return Math.max(2, base - (growthTypeId === "growth.conversion" ? 2 : 0));
}

export function startPositionConversion(
  state: GameState,
  playerId: PlayerId,
  targetPosition: Position,
): GameState {
  const school = state.schools[state.userSchoolId];
  const player = state.players[playerId];
  if (!school || !player || !school.playerIds.includes(playerId)) {
    throw new TeamPlanningValidationError(
      "invalid-position-conversion",
      "所属している選手だけポジション転向できます",
    );
  }
  if (player.preferredPosition === targetPosition) {
    throw new TeamPlanningValidationError(
      "invalid-position-conversion",
      "現在と同じポジションには転向できません",
    );
  }

  const startingAptitude = player.positionAptitudes[targetPosition];
  const plan: PositionConversionPlan = {
    targetPosition,
    weeksCompleted: 0,
    weeksRequired: conversionWeeks(startingAptitude, player.growthTypeId),
    startingAptitude,
  };
  return {
    ...state,
    teamPlanning: {
      ...state.teamPlanning,
      positionConversionsByPlayerId: {
        ...(state.teamPlanning.positionConversionsByPlayerId ?? {}),
        [playerId]: plan,
      },
    },
  };
}

export function cancelPositionConversion(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const current = { ...(state.teamPlanning.positionConversionsByPlayerId ?? {}) };
  if (!current[playerId]) return state;
  delete current[playerId];
  return {
    ...state,
    teamPlanning: {
      ...state.teamPlanning,
      positionConversionsByPlayerId: current,
    },
  };
}

export function progressPositionConversionsWeekly(
  state: GameState,
): GameState {
  const plans = state.teamPlanning.positionConversionsByPlayerId ?? {};
  const activeEntries = Object.entries(plans) as Array<
    [PlayerId, PositionConversionPlan]
  >;
  if (activeEntries.length === 0) return state;

  let players = state.players;
  let changedPlayers = false;
  const nextPlans: Partial<Record<PlayerId, PositionConversionPlan>> = {
    ...plans,
  };

  for (const [playerId, plan] of activeEntries) {
    const player = state.players[playerId];
    if (!player || player.career.schoolId !== state.userSchoolId) {
      delete nextPlans[playerId];
      continue;
    }

    const weeksCompleted = Math.min(
      plan.weeksRequired,
      plan.weeksCompleted + 1,
    );
    const progressRatio = weeksCompleted / Math.max(1, plan.weeksRequired);
    const targetAptitude = Math.max(
      player.positionAptitudes[plan.targetPosition],
      Math.round(plan.startingAptitude + (75 - plan.startingAptitude) * progressRatio),
    );
    const completed = weeksCompleted >= plan.weeksRequired;

    if (!changedPlayers) {
      players = { ...state.players };
      changedPlayers = true;
    }
    players[playerId] = {
      ...player,
      ...(completed ? { preferredPosition: plan.targetPosition } : {}),
      positionAptitudes: {
        ...player.positionAptitudes,
        [plan.targetPosition]: Math.max(
          completed ? 75 : targetAptitude,
          targetAptitude,
        ),
      },
    };

    if (completed) {
      delete nextPlans[playerId];
    } else {
      nextPlans[playerId] = { ...plan, weeksCompleted };
    }
  }

  return {
    ...state,
    players,
    teamPlanning: {
      ...state.teamPlanning,
      positionConversionsByPlayerId: nextPlans,
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
