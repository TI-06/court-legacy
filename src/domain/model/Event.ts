import type { EventId, GameDate, PlayerId, SchoolId } from "./identifiers";

export type EventCategory =
  | "individual"
  | "relationship"
  | "practice"
  | "injury"
  | "academic"
  | "match"
  | "captaincy"
  | "scouting"
  | "rivalry"
  | "ob"
  | "rare"
  | "seasonal";

export interface PendingEvent {
  eventId: EventId;
  actorPlayerIds: PlayerId[];
  targetSchoolId: SchoolId | null;
  surfacedDate: GameDate;
  choiceIds: string[];
  chainId: string | null;
  chainStage: number | null;
}

export interface ScheduledEventFollowUp {
  eventId: EventId;
  eligibleDate: GameDate;
  actorPlayerIds: PlayerId[];
  chainId: string | null;
  chainStage: number | null;
}

export interface EventOccurrence {
  eventId: EventId;
  date: GameDate;
  actorPlayerIds: PlayerId[];
  choiceId: string;
  visibleResultCodes: string[];
}

export interface EventMemory {
  lastOccurredDateByEventId: Partial<Record<EventId, GameDate>>;
  occurrenceCountByEventId: Partial<Record<EventId, number>>;
  occurredCareerKeys: string[];
  recentEventIds: EventId[];
  recentCategoryIds: EventCategory[];
  recentPrimaryActorPlayerIds: PlayerId[];
  scheduledFollowUps: ScheduledEventFollowUp[];
  history: EventOccurrence[];
}
