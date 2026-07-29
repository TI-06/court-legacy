import type { GameDataRegistry } from "../../data/dataRegistry";
import type {
  EventChoiceDefinition,
  EventDefinition,
  EventEffect,
} from "../validation/gameDataSchema";
import type { EventOccurrence, ScheduledEventFollowUp } from "../model/Event";
import { eventCareerKey } from "./eventEligibility";
import { relationshipKey, type GameState } from "../model/GameState";
import { clampAbility, type Player } from "../model/Player";
import type { SchoolFacilities } from "../model/School";
import type { EventId, PlayerId } from "../model/identifiers";
import { eventId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";
import { addWeeks } from "./eventDate";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, Math.round(value)));

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function updateActors(
  state: GameState,
  actorPlayerIds: readonly PlayerId[],
  update: (player: Player) => Player,
): GameState {
  const players = { ...state.players };
  for (const actorId of actorPlayerIds) {
    const player = players[actorId];
    if (player) {
      players[actorId] = update(player);
    }
  }
  return { ...state, players };
}

function applyEffect(
  state: GameState,
  effect: EventEffect,
  actorPlayerIds: readonly PlayerId[],
  event: EventDefinition,
  random: RandomSource,
): {
  state: GameState;
  visibleResult: string;
  followUp?: ScheduledEventFollowUp;
} {
  switch (effect.type) {
    case "ability-change":
      return {
        state: updateActors(state, actorPlayerIds, (player) => ({
          ...player,
          abilities: {
            ...player.abilities,
            [effect.ability]: clampAbility(
              player.abilities[effect.ability] + effect.amount,
            ),
          },
        })),
        visibleResult: `${effect.ability} ${signed(effect.amount)}`,
      };
    case "morale-change":
    case "fatigue-change":
    case "trust-change": {
      const key = effect.type.replace("-change", "") as
        "morale" | "fatigue" | "trust";
      const label =
        key === "morale" ? "士気" : key === "fatigue" ? "疲労" : "信頼";
      return {
        state: updateActors(state, actorPlayerIds, (player) => ({
          ...player,
          [key]: clamp(player[key] + effect.amount, 0, 100),
        })),
        visibleResult: `${label} ${signed(effect.amount)}`,
      };
    }
    case "relationship-change": {
      const [left, right] = actorPlayerIds;
      if (!left || !right) {
        return { state, visibleResult: "関係変化なし" };
      }
      const key = relationshipKey(left, right);
      const current = state.playerRelationships[key] ?? 50;
      return {
        state: {
          ...state,
          playerRelationships: {
            ...state.playerRelationships,
            [key]: clamp(current + effect.amount, 0, 100),
          },
        },
        visibleResult: `連携 ${signed(effect.amount)}`,
      };
    }
    case "reputation-change": {
      const school = state.schools[state.userSchoolId];
      if (!school) {
        return { state, visibleResult: "評判変化なし" };
      }
      return {
        state: {
          ...state,
          schools: {
            ...state.schools,
            [state.userSchoolId]: {
              ...school,
              reputationPoints: clamp(
                school.reputationPoints + effect.amount,
                0,
                1000,
              ),
            },
          },
        },
        visibleResult: `学校評判 ${signed(effect.amount)}`,
      };
    }
    case "funds-change": {
      const school = state.schools[state.userSchoolId];
      if (!school) {
        return { state, visibleResult: "資金変化なし" };
      }
      return {
        state: {
          ...state,
          schools: {
            ...state.schools,
            [state.userSchoolId]: {
              ...school,
              funds: Math.max(0, school.funds + effect.amount),
            },
          },
        },
        visibleResult: `資金 ${signed(effect.amount)}`,
      };
    }
    case "facility-change": {
      const school = state.schools[state.userSchoolId];
      if (!school) {
        return { state, visibleResult: "設備変化なし" };
      }
      const facility = effect.facility as keyof SchoolFacilities;
      return {
        state: {
          ...state,
          schools: {
            ...state.schools,
            [state.userSchoolId]: {
              ...school,
              facilities: {
                ...school.facilities,
                [facility]: clamp(
                  school.facilities[facility] + effect.amount,
                  0,
                  5,
                ),
              },
            },
          },
        },
        visibleResult: `設備 ${signed(effect.amount)}`,
      };
    }
    case "injury-set":
      return {
        state: updateActors(state, actorPlayerIds, (player) => ({
          ...player,
          injury: {
            injuryId: `${event.id}:${state.date}:${player.id}`,
            severity: effect.severity,
            remainingWeeks: effect.weeks,
            recurrenceRisk: effect.recurrenceRisk,
          },
        })),
        visibleResult: `負傷 ${effect.weeks}週`,
      };
    case "injury-clear":
      return {
        state: updateActors(state, actorPlayerIds, (player) => ({
          ...player,
          injury: null,
        })),
        visibleResult: "負傷から回復",
      };
    case "add-trait":
      return {
        state: updateActors(state, actorPlayerIds, (player) => ({
          ...player,
          traitIds: player.traitIds.includes(effect.traitId)
            ? player.traitIds
            : [...player.traitIds, effect.traitId],
        })),
        visibleResult: "選手の特徴に変化",
      };
    case "remove-trait":
      return {
        state: updateActors(state, actorPlayerIds, (player) => ({
          ...player,
          traitIds: player.traitIds.filter((id) => id !== effect.traitId),
        })),
        visibleResult: "選手の特徴に変化",
      };
    case "schedule-event": {
      const scheduled = random.int(1, 100) <= effect.probability;
      return {
        state,
        visibleResult: "今後に影響する可能性",
        followUp: scheduled
          ? {
              eventId: eventId(effect.eventId),
              eligibleDate: addWeeks(state.date, effect.afterWeeks),
              actorPlayerIds: [...actorPlayerIds],
              chainId: `${event.id}:${state.date}`,
              chainStage: 1,
            }
          : undefined,
      };
    }
  }
}

function scheduleChoiceFollowUp(
  state: GameState,
  event: EventDefinition,
  choice: EventChoiceDefinition,
  actorPlayerIds: readonly PlayerId[],
  random: RandomSource,
): ScheduledEventFollowUp | null {
  if (!choice.followUp || random.int(1, 100) > choice.followUp.probability) {
    return null;
  }
  return {
    eventId: eventId(choice.followUp.eventId),
    eligibleDate: addWeeks(state.date, choice.followUp.afterWeeks),
    actorPlayerIds: [...actorPlayerIds],
    chainId: state.pendingEvent?.chainId ?? `${event.id}:${state.date}`,
    chainStage: (state.pendingEvent?.chainStage ?? 0) + 1,
  };
}

function pushLimited<T>(items: readonly T[], item: T, limit: number): T[] {
  return [...items, item].slice(-limit);
}

export interface ResolveEventChoiceResult {
  state: GameState;
  occurrence: EventOccurrence;
}

export function resolveEventChoice(
  state: GameState,
  choiceId: string,
  data: GameDataRegistry,
  random: RandomSource,
): ResolveEventChoiceResult {
  const pending = state.pendingEvent;
  if (!pending) {
    throw new Error("解決するイベントがありません");
  }
  const event = data.events.get(pending.eventId);
  if (!event) {
    throw new Error(`イベント定義が見つかりません: ${pending.eventId}`);
  }
  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (!choice || !pending.choiceIds.includes(choiceId)) {
    throw new Error(`選択肢が見つかりません: ${choiceId}`);
  }

  let nextState: GameState = state;
  const visibleResultCodes: string[] = [];
  const scheduledFollowUps: ScheduledEventFollowUp[] = [];
  for (const effect of choice.effects) {
    const applied = applyEffect(
      nextState,
      effect,
      pending.actorPlayerIds,
      event,
      random,
    );
    nextState = applied.state;
    visibleResultCodes.push(applied.visibleResult);
    if (applied.followUp) {
      scheduledFollowUps.push(applied.followUp);
    }
  }
  const choiceFollowUp = scheduleChoiceFollowUp(
    nextState,
    event,
    choice,
    pending.actorPlayerIds,
    random,
  );
  if (choiceFollowUp) {
    scheduledFollowUps.push(choiceFollowUp);
  }

  const occurrence: EventOccurrence = {
    eventId: pending.eventId as EventId,
    date: state.date,
    actorPlayerIds: [...pending.actorPlayerIds],
    choiceId,
    visibleResultCodes,
  };
  const careerKey = eventCareerKey(event, pending.actorPlayerIds);
  const occurredCareerKeys = event.oncePerCareer
    ? [...new Set([...state.eventMemory.occurredCareerKeys, careerKey])]
    : state.eventMemory.occurredCareerKeys;
  const primaryActor = pending.actorPlayerIds[0];

  nextState = {
    ...nextState,
    randomCursor: random.cursor,
    pendingEvent: null,
    eventMemory: {
      ...nextState.eventMemory,
      lastOccurredDateByEventId: {
        ...nextState.eventMemory.lastOccurredDateByEventId,
        [event.id]: state.date,
      },
      occurrenceCountByEventId: {
        ...nextState.eventMemory.occurrenceCountByEventId,
        [event.id]:
          (nextState.eventMemory.occurrenceCountByEventId[event.id] ?? 0) + 1,
      },
      occurredCareerKeys,
      recentEventIds: pushLimited(
        nextState.eventMemory.recentEventIds,
        pending.eventId,
        8,
      ),
      recentCategoryIds: pushLimited(
        nextState.eventMemory.recentCategoryIds,
        event.category,
        6,
      ),
      recentPrimaryActorPlayerIds: primaryActor
        ? pushLimited(
            nextState.eventMemory.recentPrimaryActorPlayerIds,
            primaryActor,
            8,
          )
        : nextState.eventMemory.recentPrimaryActorPlayerIds,
      scheduledFollowUps: [
        ...nextState.eventMemory.scheduledFollowUps,
        ...scheduledFollowUps,
      ],
      history: pushLimited(nextState.eventMemory.history, occurrence, 200),
    },
  };

  return { state: nextState, occurrence };
}
