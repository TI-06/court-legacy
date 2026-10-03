import type { TeamSelection } from "../model/TeamSelection";
import type { PlayerId } from "../model/identifiers";

export type SavedLineupSlot = 1 | 2 | 3;
export type DevelopmentGoalArea =
  "attack" | "defense" | "jump" | "stamina" | "mental";
export type DevelopmentGoalGrade =
  "S" | "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type TeamIdentityStyle =
  | "quick-combination"
  | "serve-block"
  | "defense-rally"
  | "ace-centered"
  | "balanced";

export interface TeamIdentityState {
  style: TeamIdentityStyle;
  mastery: number;
  weeksInStyle: number;
  changeCount: number;
}

export interface PlayerDevelopmentGoal {
  area: DevelopmentGoalArea;
  targetGrade: DevelopmentGoalGrade;
}

export interface SavedLineupPreset {
  slot: SavedLineupSlot;
  name: string;
  selection: TeamSelection;
}

export interface TeamPlanningState {
  developmentPriorityPlayerIds: PlayerId[];
  developmentGoalsByPlayerId?: Partial<Record<PlayerId, PlayerDevelopmentGoal>>;
  savedLineups: SavedLineupPreset[];
  /**
   * Phase56 team identity is optional for backward compatibility with
   * schema-v10 saves. Missing values resolve to the balanced default.
   */
  teamIdentity?: TeamIdentityState;
}
