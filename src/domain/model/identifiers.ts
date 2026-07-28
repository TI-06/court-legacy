type Brand<Value, Name extends string> = Value & {
  readonly __brand: Name;
};

export type PlayerId = Brand<string, "PlayerId">;
export type SchoolId = Brand<string, "SchoolId">;
export type EventId = Brand<string, "EventId">;
export type MatchId = Brand<string, "MatchId">;
export type GameDate = `${number}-${number}-${number}`;

function assertIdentifier(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must not be empty`);
  }
}

export function playerId(value: string): PlayerId {
  assertIdentifier(value, "player id");
  return value as PlayerId;
}

export function schoolId(value: string): SchoolId {
  assertIdentifier(value, "school id");
  return value as SchoolId;
}

export function eventId(value: string): EventId {
  assertIdentifier(value, "event id");
  return value as EventId;
}

export function matchId(value: string): MatchId {
  assertIdentifier(value, "match id");
  return value as MatchId;
}
