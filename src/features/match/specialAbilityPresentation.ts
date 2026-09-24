import type { GameState } from "../../domain/model/GameState";
import type { MatchEvent } from "../../domain/model/Match";
import type { Player } from "../../domain/model/Player";
import {
  getSpecialAbilityDefinition,
  type SpecialAbilityCategory,
  type SpecialAbilityKind,
} from "../../domain/player/specialAbilities";

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
