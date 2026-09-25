import type { GameState } from "../../domain/model/GameState";
import type { MatchEvent } from "../../domain/model/Match";
import type { Player, PlayerAbilities } from "../../domain/model/Player";
import {
  getSpecialAbilityDefinition,
  type SpecialAbilityCategory,
  type SpecialAbilityKind,
} from "../../domain/player/specialAbilities";
import {
  getServeSpecialAbilityAdjustment,
  getSpecialAbilityAbilityDelta,
  type MatchSpecialAbilitySituation,
} from "../../domain/player/specialAbilityMatchModifiers";

export interface MatchSpecialAbilityBadge {
  id: string;
  name: string;
  kind: SpecialAbilityKind;
  description: string;
}

const KIND_ORDER: Record<SpecialAbilityKind, number> = {
  gold: 0,
  elite: 1,
  negative: 2,
  positive: 3,
};

const EVENT_CATEGORIES: Partial<
  Record<MatchEvent["type"], readonly SpecialAbilityCategory[]>
> = {
  serve: ["serve", "mental", "team", "overall", "decision"],
  receive: ["receive", "mental", "team", "overall", "decision"],
  set: ["set", "mental", "team", "overall", "decision"],
  attack: ["attack", "mental", "team", "overall", "decision"],
  block: ["block", "mental", "team", "overall", "decision"],
  dig: ["receive", "mental", "team", "overall", "decision"],
};

const EVENT_ABILITY_KEYS: Partial<
  Record<MatchEvent["type"], readonly (keyof PlayerAbilities)[]>
> = {
  serve: ["serve", "mental", "decision"],
  receive: ["receive", "speed", "decision", "mental"],
  set: ["set", "decision", "mental"],
  attack: ["spike", "jump", "speed", "decision", "mental"],
  block: ["block", "jump", "speed", "decision", "mental"],
  dig: ["receive", "speed", "decision", "mental"],
};

export interface MatchSpecialAbilityPresentationContext {
  homeSchoolId: Player["career"]["schoolId"];
  awaySchoolId: Player["career"]["schoolId"];
  bestOfSets: 3 | 5;
}

function matchSituationForEvent(
  player: Player,
  context: MatchSpecialAbilityPresentationContext,
  event: MatchEvent,
): MatchSpecialAbilitySituation | null {
  if (player.career.schoolId === context.homeSchoolId) {
    return {
      ownScore: event.homeScore,
      opponentScore: event.awayScore,
      setNumber: event.setNumber,
      bestOfSets: context.bestOfSets,
    };
  }
  if (player.career.schoolId === context.awaySchoolId) {
    return {
      ownScore: event.awayScore,
      opponentScore: event.homeScore,
      setNumber: event.setNumber,
      bestOfSets: context.bestOfSets,
    };
  }
  return null;
}

function specialAbilityHasActiveEffect(
  player: Player,
  abilityId: string,
  event: MatchEvent,
  situation: MatchSpecialAbilitySituation,
): boolean {
  const isolatedPlayer = {
    ...player,
    specialAbilityIds: [abilityId],
  };
  const abilityKeys = EVENT_ABILITY_KEYS[event.type] ?? [];
  if (
    abilityKeys.some(
      (ability) =>
        getSpecialAbilityAbilityDelta(isolatedPlayer, ability, situation) !== 0,
    )
  ) {
    return true;
  }
  if (event.type !== "serve") {
    return false;
  }
  return Object.values(
    getServeSpecialAbilityAdjustment(isolatedPlayer, situation),
  ).some((value) => value !== 0);
}

function badgesForPlayer(player: Player): MatchSpecialAbilityBadge[] {
  return (player.specialAbilityIds ?? [])
    .map((abilityId) => getSpecialAbilityDefinition(abilityId))
    .filter((ability) => ability !== undefined)
    .sort((left, right) => {
      const kindDifference = KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
      return kindDifference !== 0
        ? kindDifference
        : left.name.localeCompare(right.name, "ja");
    })
    .map(({ id, name, kind, description }) => ({
      id,
      name,
      kind,
      description,
    }));
}

export function presentPlayerSpecialAbilities(
  player: Player,
  limit = 2,
): MatchSpecialAbilityBadge[] {
  return badgesForPlayer(player).slice(0, Math.max(0, limit));
}

export function presentEventSpecialAbilities(
  state: GameState,
  event: MatchEvent,
  limit = 3,
): MatchSpecialAbilityBadge[] {
  const actorPlayerId = event.actorPlayerId;
  if (!actorPlayerId) return [];

  const player = state.players[actorPlayerId];
  if (!player || player.career.schoolId !== state.userSchoolId) {
    return [];
  }

  const eventCategories = EVENT_CATEGORIES[event.type];
  if (!eventCategories || eventCategories.length === 0) {
    return [];
  }
  const allowedCategories = new Set(eventCategories);

  return badgesForPlayer(player)
    .filter((ability) => {
      const definition = getSpecialAbilityDefinition(ability.id);
      return definition ? allowedCategories.has(definition.category) : false;
    })
    .slice(0, Math.max(0, limit));
}

export function presentActivatedEventSpecialAbilities(
  state: GameState,
  context: MatchSpecialAbilityPresentationContext,
  event: MatchEvent,
  limit = 3,
): MatchSpecialAbilityBadge[] {
  const actorPlayerId = event.actorPlayerId;
  if (!actorPlayerId) return [];

  const player = state.players[actorPlayerId];
  if (!player || player.career.schoolId !== state.userSchoolId) {
    return [];
  }

  const eventCategories = EVENT_CATEGORIES[event.type];
  const situation = matchSituationForEvent(player, context, event);
  if (
    !eventCategories ||
    eventCategories.length === 0 ||
    !situation ||
    !EVENT_ABILITY_KEYS[event.type]
  ) {
    return [];
  }

  const allowedCategories = new Set(eventCategories);
  return badgesForPlayer(player)
    .filter((ability) => {
      const definition = getSpecialAbilityDefinition(ability.id);
      return (
        definition &&
        allowedCategories.has(definition.category) &&
        specialAbilityHasActiveEffect(player, ability.id, event, situation)
      );
    })
    .slice(0, Math.max(0, limit));
}
