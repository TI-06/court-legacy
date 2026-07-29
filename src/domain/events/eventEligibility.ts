import type {
  EventDefinition,
  EventTrigger,
} from "../validation/gameDataSchema";
import type { ActivityType } from "../model/Calendar";
import { relationshipKey, type GameState } from "../model/GameState";
import type { Player } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import { monthOf, weeksBetween } from "./eventDate";

const TOURNAMENT_TYPES: readonly ActivityType[] = [
  "qualifier",
  "prefectural-tournament",
  "national-tournament",
];

function withinRange(
  value: number,
  range: { min?: number; max?: number } | undefined,
): boolean {
  if (!range) {
    return true;
  }
  return (
    (range.min === undefined || value >= range.min) &&
    (range.max === undefined || value <= range.max)
  );
}

function currentActivityTypes(state: GameState): ActivityType[] {
  return state.calendar.activities
    .filter((activity) => activity.date === state.date)
    .map((activity) => activity.type);
}

function recentMatchResult(state: GameState): "win" | "loss" | null {
  const match = [...state.history.matches]
    .reverse()
    .find(
      (candidate) =>
        candidate.homeSchoolId === state.userSchoolId ||
        candidate.awaySchoolId === state.userSchoolId,
    );
  if (!match) {
    return null;
  }
  return match.winnerSchoolId === state.userSchoolId ? "win" : "loss";
}

function playerMatchesTrigger(player: Player, trigger: EventTrigger): boolean {
  if (trigger.minGrade !== undefined && player.grade < trigger.minGrade) {
    return false;
  }
  if (trigger.maxGrade !== undefined && player.grade > trigger.maxGrade) {
    return false;
  }
  if (
    trigger.requiredTraitIds?.some(
      (traitId) => !player.traitIds.includes(traitId),
    )
  ) {
    return false;
  }
  if (
    trigger.excludedTraitIds?.some((traitId) =>
      player.traitIds.includes(traitId),
    )
  ) {
    return false;
  }
  if (trigger.injuryState === "healthy" && player.injury) {
    return false;
  }
  if (trigger.injuryState === "injured" && !player.injury) {
    return false;
  }
  if (!withinRange(player.morale, trigger.morale)) {
    return false;
  }
  if (!withinRange(player.fatigue, trigger.fatigue)) {
    return false;
  }
  if (!withinRange(player.trust, trigger.trust)) {
    return false;
  }
  if (!withinRange(player.academic, trigger.academic)) {
    return false;
  }
  if (
    trigger.abilityRanges &&
    Object.entries(trigger.abilityRanges).some(([ability, range]) => {
      const key = ability as keyof Player["abilities"];
      return !withinRange(player.abilities[key], range);
    })
  ) {
    return false;
  }
  return true;
}

export function isEventOnCooldown(
  state: GameState,
  event: EventDefinition,
): boolean {
  const lastDate = state.eventMemory.lastOccurredDateByEventId[event.id];
  return Boolean(
    lastDate && weeksBetween(lastDate, state.date) < event.cooldownWeeks,
  );
}

export function eventCareerKey(
  event: EventDefinition,
  actorPlayerIds: readonly PlayerId[],
): string {
  return `${event.id}:${[...actorPlayerIds].sort().join(",")}`;
}

export function isEventEligibleForActors(
  state: GameState,
  event: EventDefinition,
  actorPlayerIds: readonly PlayerId[],
): boolean {
  if (actorPlayerIds.length !== event.actorCount) {
    return false;
  }
  const actors = actorPlayerIds.map((id) => state.players[id]);
  if (actors.some((actor) => !actor)) {
    return false;
  }
  const userSchool = state.schools[state.userSchoolId];
  if (!userSchool) {
    return false;
  }
  const trigger = event.trigger;
  if (trigger.months && !trigger.months.includes(monthOf(state.date))) {
    return false;
  }
  if (
    trigger.schoolReputationMin !== undefined &&
    userSchool.reputationPoints < trigger.schoolReputationMin
  ) {
    return false;
  }
  if (
    trigger.schoolReputationMax !== undefined &&
    userSchool.reputationPoints > trigger.schoolReputationMax
  ) {
    return false;
  }
  if (
    trigger.schoolFundsMin !== undefined &&
    userSchool.funds < trigger.schoolFundsMin
  ) {
    return false;
  }
  if (
    trigger.schoolFundsMax !== undefined &&
    userSchool.funds > trigger.schoolFundsMax
  ) {
    return false;
  }
  if (
    trigger.recordKey &&
    (state.history.schoolRecordValues[trigger.recordKey] ?? 0) <
      (trigger.recordMin ?? 1)
  ) {
    return false;
  }
  if (
    trigger.recentMatchResult &&
    recentMatchResult(state) !== trigger.recentMatchResult
  ) {
    return false;
  }
  const activityTypes = currentActivityTypes(state);
  if (
    trigger.tournamentOnly &&
    !activityTypes.some((type) => TOURNAMENT_TYPES.includes(type))
  ) {
    return false;
  }
  if (
    trigger.tournamentStages &&
    !activityTypes.some((type) => trigger.tournamentStages?.includes(type))
  ) {
    return false;
  }
  if (
    !actors.every((actor) => playerMatchesTrigger(actor as Player, trigger))
  ) {
    return false;
  }
  if (trigger.relationship && actorPlayerIds.length >= 2) {
    const [left, right] = actorPlayerIds;
    if (!left || !right) {
      return false;
    }
    const relationship =
      state.playerRelationships[relationshipKey(left, right)] ?? 50;
    if (!withinRange(relationship, trigger.relationship)) {
      return false;
    }
  }
  if (isEventOnCooldown(state, event)) {
    return false;
  }
  if (
    event.oncePerCareer &&
    state.eventMemory.occurredCareerKeys.includes(
      eventCareerKey(event, actorPlayerIds),
    )
  ) {
    return false;
  }
  return true;
}
