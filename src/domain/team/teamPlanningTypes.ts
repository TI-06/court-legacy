import type { TeamSelection } from "../model/TeamSelection";
import type { PlayerId } from "../model/identifiers";

export type SavedLineupSlot = 1 | 2 | 3;

export interface SavedLineupPreset {
  slot: SavedLineupSlot;
  name: string;
  selection: TeamSelection;
}

export interface TeamPlanningState {
  developmentPriorityPlayerIds: PlayerId[];
  savedLineups: SavedLineupPreset[];
}
