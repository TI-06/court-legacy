import type { GameDataRegistry } from "../../data/dataRegistry";
import type { EventDefinition } from "../validation/gameDataSchema";
import type { PendingEvent, ScheduledEventFollowUp } from "../model/Event";
import type { GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";
import { eventId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";
import { weightedChoice } from "../random/weightedChoice";
import { isEventEligibleForActors } from "./eventEligibility";

interface EventCandidate {
  event: EventDefinition;
  actorPlayerIds: PlayerId[];
  weight: number;
}

export interface EventSelectionResult {
  state: GameState;
  pendingEvent: PendingEvent | null;
}

function combinations<T>(items: readonly T[], count: number): T[][] {
  if (count === 0) {
    return [[]];
  }
  const result: T[][] = [];
  const visit = (start: number, chosen: T[]) => {
    if (chosen.length === count) {
      result.push(chosen);
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      const item = items[index];
      if (item !== undefined) {
        visit(index + 1, [...chosen, item]);
      }
    }
  };
  visit(0, []);
  return result;
}

function createPendingEvent(
  state: GameState,
  event: EventDefinition,
  actorPlayerIds: PlayerId[],
  followUp?: ScheduledEventFollowUp,
): PendingEvent {
  return {
    eventId: eventId(event.id),
    actorPlayerIds,
    targetSchoolId: null,
    surfacedDate: state.date,
    choiceIds: event.choices.map((choice) => choice.id),
    chainId: followUp?.chainId ?? null,
    chainStage: followUp?.chainStage ?? null,
  };
}

function selectDueFollowUp(
  state: GameState,
  data: GameDataRegistry,
): { followUp: ScheduledEventFollowUp; event: EventDefinition } | null {
  const due = state.eventMemory.scheduledFollowUps
    .filter((followUp) => followUp.eligibleDate <= state.date)
    .sort((left, right) => left.eligibleDate.localeCompare(right.eligibleDate));

  for (const followUp of due) {
    const event = data.events.get(followUp.eventId);
    if (
      event &&
      isEventEligibleForActors(state, event, followUp.actorPlayerIds)
    ) {
      return { followUp, event };
    }
  }
  return null;
}

function pruneInvalidDueFollowUps(
  state: GameState,
  data: GameDataRegistry,
): ScheduledEventFollowUp[] {
  return state.eventMemory.scheduledFollowUps.filter((followUp) => {
    if (followUp.eligibleDate > state.date) {
      return true;
    }
    const event = data.events.get(followUp.eventId);
    return Boolean(
      event && isEventEligibleForActors(state, event, followUp.actorPlayerIds),
    );
  });
}

function normalCandidates(
  state: GameState,
  data: GameDataRegistry,
  avoidRecentActors: boolean,
): EventCandidate[] {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    return [];
  }
  const playerIds = school.playerIds.filter((id) => state.players[id]);
  const recentActors = new Set(state.eventMemory.recentPrimaryActorPlayerIds);
  const candidates: EventCandidate[] = [];

  for (const event of data.events.values()) {
    for (const actorPlayerIds of combinations(playerIds, event.actorCount)) {
      const primaryActor = actorPlayerIds[0];
      if (avoidRecentActors && primaryActor && recentActors.has(primaryActor)) {
        continue;
      }
      if (!isEventEligibleForActors(state, event, actorPlayerIds)) {
        continue;
      }
      const recentEventPenalty = state.eventMemory.recentEventIds.includes(
        eventId(event.id),
      )
        ? 0.2
        : 1;
      const recentCategoryPenalty =
        state.eventMemory.recentCategoryIds.includes(event.category) ? 0.35 : 1;
      candidates.push({
        event,
        actorPlayerIds,
        weight: Math.max(
          1,
          Math.round(event.weight * recentEventPenalty * recentCategoryPenalty),
        ),
      });
    }
  }
  return candidates;
}

export function selectNextEvent(
  state: GameState,
  data: GameDataRegistry,
  random: RandomSource,
): EventSelectionResult {
  if (state.pendingEvent) {
    return { state, pendingEvent: state.pendingEvent };
  }

  const dueFollowUp = selectDueFollowUp(state, data);
  const prunedFollowUps = pruneInvalidDueFollowUps(state, data);
  if (dueFollowUp) {
    const remaining = prunedFollowUps.filter(
      (candidate) => candidate !== dueFollowUp.followUp,
    );
    const pendingEvent = createPendingEvent(
      state,
      dueFollowUp.event,
      dueFollowUp.followUp.actorPlayerIds,
      dueFollowUp.followUp,
    );
    const nextState = {
      ...state,
      randomCursor: random.cursor,
      pendingEvent,
      eventMemory: {
        ...state.eventMemory,
        scheduledFollowUps: remaining,
      },
    };
    return { state: nextState, pendingEvent };
  }

  let candidates = normalCandidates(state, data, true);
  if (candidates.length === 0) {
    candidates = normalCandidates(state, data, false);
  }
  if (candidates.length === 0) {
    return {
      state: {
        ...state,
        randomCursor: random.cursor,
        eventMemory: {
          ...state.eventMemory,
          scheduledFollowUps: prunedFollowUps,
        },
      },
      pendingEvent: null,
    };
  }

  const selected = weightedChoice(
    candidates.map((candidate) => ({
      value: candidate,
      weight: candidate.weight,
    })),
    random,
  );
  const pendingEvent = createPendingEvent(
    state,
    selected.event,
    selected.actorPlayerIds,
  );
  const nextState = {
    ...state,
    randomCursor: random.cursor,
    pendingEvent,
    eventMemory: {
      ...state.eventMemory,
      scheduledFollowUps: prunedFollowUps,
    },
  };
  return { state: nextState, pendingEvent };
}
