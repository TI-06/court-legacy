export const scoutingRegions = ["prefecture", "regional", "national"] as const;
export type ScoutingRegion = (typeof scoutingRegions)[number];

export const scoutingPositions = ["any", "OH", "MB", "S", "OP", "L"] as const;
export type ScoutingPosition = (typeof scoutingPositions)[number];

export const scoutingPriorities = [
  "ability",
  "potential",
  "physical",
  "immediate",
  "hidden",
] as const;
export type ScoutingPriority = (typeof scoutingPriorities)[number];

export interface ScoutingSearchCriteria {
  region: ScoutingRegion;
  position: ScoutingPosition;
  priority: ScoutingPriority;
}

export const defaultScoutingSearchCriteria: ScoutingSearchCriteria = {
  region: "prefecture",
  position: "any",
  priority: "ability",
};
