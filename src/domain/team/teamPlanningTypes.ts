import type { Position } from "../model/Player";
import type { TeamSelection } from "../model/TeamSelection";
import type { PlayerId } from "../model/identifiers";

export type SavedLineupSlot = 1 | 2 | 3;
export type DevelopmentGoalArea =
  "attack" | "defense" | "jump" | "stamina" | "mental";
export type DevelopmentGoalGrade =
  "S" | "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface PlayerDevelopmentGoal {
  area: DevelopmentGoalArea;
  targetGrade: DevelopmentGoalGrade;
}

export interface PlayerPositionConversion {
  fromPosition: Position;
  targetPosition: Position;
  completedWeeks: number;
  requiredWeeks: number;
}

export interface SavedLineupPreset {
  slot: SavedLineupSlot;
  name: string;
  selection: TeamSelection;
}

export interface TeamPlanningState {
  developmentPriorityPlayerIds: PlayerId[];
  developmentGoalsByPlayerId?: Partial<Record<PlayerId, PlayerDevelopmentGoal>>;
  positionConversionsByPlayerId?: Partial<
    Record<PlayerId, PlayerPositionConversion>
  >;
  savedLineups: SavedLineupPreset[];
}
