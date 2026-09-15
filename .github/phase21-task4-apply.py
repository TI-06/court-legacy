from pathlib import Path

Path("src/domain/relationships/specialRelationships.ts").write_text(r'''import { weeksBetween } from "../events/eventDate";
import { relationshipKey, type GameState } from "../model/GameState";
import type { EventId, GameDate, PlayerId } from "../model/identifiers";
import type {
  PlayerRelationshipBond,
  SpecialRelationshipKind,
  SpecialRelationshipTag,
  SpecialRelationshipTransition,
} from "./relationshipTypes";

interface RelationshipStateLike {
  playerRelationshipBonds: Record<string, PlayerRelationshipBond>;
}

interface AddSpecialRelationshipInput {
  playerIds: [PlayerId, PlayerId];
  kind: SpecialRelationshipKind;
  establishedDate: GameDate;
  sourceEventId?: EventId | null;
  mentorPlayerId?: PlayerId;
  protegePlayerId?: PlayerId;
}

interface RemoveSpecialRelationshipInput {
  playerIds: [PlayerId, PlayerId];
  kind: SpecialRelationshipKind;
}

function canonicalPair(left: PlayerId, right: PlayerId): [PlayerId, PlayerId] {
  if (left === right) {
    throw new Error("self relationship is not allowed");
  }
  return left < right ? [left, right] : [right, left];
}

function validateMentorDirection(
  pair: readonly [PlayerId, PlayerId],
  input: AddSpecialRelationshipInput,
): void {
  if (input.kind !== "mentor") return;
  if (!input.mentorPlayerId || !input.protegePlayerId) {
    throw new Error("mentor relationship requires mentor and protege players");
  }
  if (input.mentorPlayerId === input.protegePlayerId) {
    throw new Error("mentor and protege must be different players");
  }
  const pairIds = new Set(pair);
  if (
    !pairIds.has(input.mentorPlayerId) ||
    !pairIds.has(input.protegePlayerId)
  ) {
    throw new Error("mentor and protege must belong to the relationship pair");
  }
}

function replaceBond<T extends RelationshipStateLike>(
  state: T,
  key: string,
  bond: PlayerRelationshipBond | null,
): T {
  const nextBonds = { ...state.playerRelationshipBonds };
  if (bond) nextBonds[key] = bond;
  else delete nextBonds[key];
  return { ...state, playerRelationshipBonds: nextBonds };
}

function deteriorationThreshold(kind: SpecialRelationshipKind): number | null {
  if (kind === "partner") return 60;
  if (kind === "mentor") return 50;
  return null;
}

export function getRelationshipBond(
  state: RelationshipStateLike,
  left: PlayerId,
  right: PlayerId,
): PlayerRelationshipBond | null {
  if (left === right) return null;
  return state.playerRelationshipBonds[relationshipKey(left, right)] ?? null;
}

export function addSpecialRelationship<T extends RelationshipStateLike>(
  state: T,
  input: AddSpecialRelationshipInput,
): { state: T; transition: SpecialRelationshipTransition | null } {
  const pair = canonicalPair(...input.playerIds);
  validateMentorDirection(pair, input);
  const key = relationshipKey(...pair);
  const existing = state.playerRelationshipBonds[key] ?? {
    playerIds: pair,
    tags: [],
  };
  const existingIndex = existing.tags.findIndex(
    (tag) => tag.kind === input.kind,
  );

  if (existingIndex >= 0) {
    const tags = existing.tags.map((tag, index) =>
      index === existingIndex
        ? {
            ...tag,
            lastReinforcedDate: input.establishedDate,
            belowThresholdSince: null,
            ...(input.kind === "mentor"
              ? {
                  mentorPlayerId: input.mentorPlayerId,
                  protegePlayerId: input.protegePlayerId,
                }
              : {}),
          }
        : tag,
    );
    return {
      state: replaceBond(state, key, { ...existing, playerIds: pair, tags }),
      transition: null,
    };
  }

  if (existing.tags.length >= 2) {
    throw new Error("maximum two special relationship tags per player pair");
  }

  const tag: SpecialRelationshipTag = {
    kind: input.kind,
    establishedDate: input.establishedDate,
    sourceEventId: input.sourceEventId ?? null,
    lastReinforcedDate: input.establishedDate,
    belowThresholdSince: null,
    ...(input.kind === "mentor"
      ? {
          mentorPlayerId: input.mentorPlayerId,
          protegePlayerId: input.protegePlayerId,
        }
      : {}),
  };
  return {
    state: replaceBond(state, key, {
      playerIds: pair,
      tags: [...existing.tags, tag],
    }),
    transition: { action: "established", kind: input.kind, playerIds: pair },
  };
}

export function removeSpecialRelationship<T extends RelationshipStateLike>(
  state: T,
  input: RemoveSpecialRelationshipInput,
): { state: T; transition: SpecialRelationshipTransition | null } {
  const pair = canonicalPair(...input.playerIds);
  const key = relationshipKey(...pair);
  const existing = state.playerRelationshipBonds[key];
  if (!existing || !existing.tags.some((tag) => tag.kind === input.kind)) {
    return { state, transition: null };
  }
  const tags = existing.tags.filter((tag) => tag.kind !== input.kind);
  return {
    state: replaceBond(
      state,
      key,
      tags.length > 0 ? { ...existing, playerIds: pair, tags } : null,
    ),
    transition: { action: "removed", kind: input.kind, playerIds: pair },
  };
}

export function progressSpecialRelationshipsWeekly(
  state: GameState,
  nextDate: GameDate,
): { state: GameState; transitions: SpecialRelationshipTransition[] } {
  const nextBonds = { ...state.playerRelationshipBonds };
  const transitions: SpecialRelationshipTransition[] = [];

  for (const [key, bond] of Object.entries(state.playerRelationshipBonds)) {
    const score = state.playerRelationships[key] ?? 50;
    const nextTags: SpecialRelationshipTag[] = [];

    for (const tag of bond.tags) {
      const threshold = deteriorationThreshold(tag.kind);
      if (threshold === null) {
        nextTags.push(tag);
        continue;
      }

      if (score >= threshold) {
        nextTags.push(
          tag.belowThresholdSince === null
            ? tag
            : { ...tag, belowThresholdSince: null },
        );
        continue;
      }

      if (tag.belowThresholdSince === null) {
        nextTags.push({ ...tag, belowThresholdSince: state.date });
        continue;
      }

      if (weeksBetween(tag.belowThresholdSince, nextDate) >= 8) {
        transitions.push({
          action: "removed",
          kind: tag.kind,
          playerIds: bond.playerIds,
        });
        continue;
      }

      nextTags.push(tag);
    }

    if (nextTags.length > 0) {
      nextBonds[key] = { ...bond, tags: nextTags };
    } else {
      delete nextBonds[key];
    }
  }

  return {
    state: { ...state, playerRelationshipBonds: nextBonds },
    transitions,
  };
}
''')

Path("src/domain/calendar/weekProgression.ts").write_text(r'''import type { GameState } from "../model/GameState";
import type { Player, PlayerInjury } from "../model/Player";
import type { GameDate, PlayerId } from "../model/identifiers";
import { progressSpecialRelationshipsWeekly } from "../relationships/specialRelationships";
import type { SpecialRelationshipTransition } from "../relationships/relationshipTypes";

export type WeeklyAction = "training" | "practice-match";

export interface WeekProgressionResult {
  state: GameState;
  recoveredPlayerIds: PlayerId[];
  healedPlayerIds: PlayerId[];
  specialRelationshipTransitions: SpecialRelationshipTransition[];
}

export interface AdvanceOneWeekOptions {
  restingPlayerIds?: ReadonlySet<PlayerId>;
}

function addDays(value: GameDate, days: number): GameDate {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`invalid game date: ${value}`);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}` as GameDate;
}

function actionId(date: GameDate, action: WeeklyAction): string {
  return `week:${date}:${action}`;
}

export function isWeeklyActionCompleted(
  state: GameState,
  action: WeeklyAction,
): boolean {
  return state.calendar.completedActivityIds.includes(
    actionId(state.date, action),
  );
}

export function markWeeklyActionCompleted(
  state: GameState,
  action: WeeklyAction,
): GameState {
  const id = actionId(state.date, action);
  if (state.calendar.completedActivityIds.includes(id)) {
    return state;
  }

  return {
    ...state,
    calendar: {
      ...state.calendar,
      completedActivityIds: [...state.calendar.completedActivityIds, id],
    },
  };
}

function progressInjury(injury: PlayerInjury | null): PlayerInjury | null {
  if (!injury) {
    return null;
  }

  const remainingWeeks = injury.remainingWeeks - 1;
  return remainingWeeks <= 0 ? null : { ...injury, remainingWeeks };
}

function recoverPlayer(player: Player): {
  player: Player;
  recovered: boolean;
  healed: boolean;
} {
  const previousInjury = player.injury;
  const injury = progressInjury(previousInjury);
  return {
    player: { ...player, injury },
    recovered: false,
    healed: Boolean(previousInjury && !injury),
  };
}

export function advanceOneWeek(
  state: GameState,
  options: AdvanceOneWeekOptions = {},
): WeekProgressionResult {
  const players = { ...state.players };
  const recoveredPlayerIds: PlayerId[] = [];
  const healedPlayerIds: PlayerId[] = [];
  // Kept in the public signature for save/action compatibility; Phase 12 no longer
  // applies automatic rest or facility-driven fatigue recovery during week advance.
  void options;

  for (const [playerId, player] of Object.entries(state.players) as Array<
    [PlayerId, Player]
  >) {
    const result = recoverPlayer(player);
    players[playerId] = result.player;
    if (result.recovered) {
      recoveredPlayerIds.push(playerId);
    }
    if (result.healed) {
      healedPlayerIds.push(playerId);
    }
  }

  const date = addDays(state.date, 7);
  const relationshipProgression = progressSpecialRelationshipsWeekly(state, date);

  return {
    state: {
      ...relationshipProgression.state,
      date,
      players,
      activeMatch: null,
      calendar: {
        ...relationshipProgression.state.calendar,
        currentDate: date,
        weekOfYear: state.calendar.weekOfYear + 1,
      },
    },
    recoveredPlayerIds,
    healedPlayerIds,
    specialRelationshipTransitions: relationshipProgression.transitions,
  };
}
''')
