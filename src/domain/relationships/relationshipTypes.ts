import type { EventId, GameDate, PlayerId } from "../model/identifiers";

export type SpecialRelationshipKind = "rival" | "mentor" | "partner";

export interface SpecialRelationshipTag {
  kind: SpecialRelationshipKind;
  establishedDate: GameDate;
  sourceEventId: EventId | null;
  lastReinforcedDate: GameDate;
  belowThresholdSince: GameDate | null;
  mentorPlayerId?: PlayerId;
  protegePlayerId?: PlayerId;
}

export interface PlayerRelationshipBond {
  playerIds: [PlayerId, PlayerId];
  tags: SpecialRelationshipTag[];
}

export interface RelationshipLegacyRecord {
  playerIds: [PlayerId, PlayerId];
  displayNames: [string, string];
  tags: SpecialRelationshipTag[];
  finalRelationshipScore: number;
  archivedDate: GameDate;
}

export interface SpecialRelationshipTransition {
  action: "established" | "removed";
  kind: SpecialRelationshipKind;
  playerIds: [PlayerId, PlayerId];
}
