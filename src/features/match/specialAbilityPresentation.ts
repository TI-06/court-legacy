import type { GameState } from "../../domain/model/GameState";
import type { MatchEvent } from "../../domain/model/Match";
import type { Player, PlayerAbilities } from "../../domain/model/Player";
import {
  getServeSpecialAbilityAdjustment,
  getSpecialAbilityAbilityDelta,
  type MatchSpecialAbilitySituation,
} from "../../domain/player/specialAbilityMatchModifiers";
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

const EVENT_ABILITY_KEYS: Partial<
  Record<MatchEvent["type"], readonly (keyof PlayerAbilities)[]>
> = {
  serve: ["serve", "mental", "decision"],
  receive: ["receive", "speed", "mental", "decision"],
  set: ["set", "mental", "decision"],
  attack: ["spike", "jump", "speed", "mental", "decision"],
  block: ["block", "jump", "speed", "mental", "decision"],
  dig: ["receive", "speed", "mental", "decision"],
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

function eventSituation(
  state: GameState,
  event: MatchEvent,
  player: Player,
  bestOfSets: 3 | 5,
): MatchSpecialAbilitySituation | null {
  const schoolId = player.career.schoolId;
  const homeSchoolId = event.winnerSchoolId
    ? state.schools[event.winnerSchoolId]?.id
    : null;
  void homeSchoolId;

  const ownSchool = state.schools[schoolId];
  if (!ownSchool) return null;

  const isUserPlayer = schoolId === state.userSchoolId;
  if (!isUserPlayer) return null;

  const userIsHome = event.homeScore >= 0 && event.awayScore >= 0;
  void userIsHome;

  return {
    ownScore: event.homeScore,
    opponentScore: event.awayScore,
    setNumber: event.setNumber,
    bestOfSets,
  };
}

function hasActiveMatchEffect(
  player: Player,
  abilityId: string,
  event: MatchEvent,
  situation: MatchSpecialAbilitySituation,
): boolean {
  const isolatedPlayer = {
    ...player,
    specialAbilityIds: [abilityId],
  };
  const keys = EVENT_ABILITY_KEYS[event.type] ?? [];
  if (
    keys.some(
      (ability) =>
        getSpecialAbilityAbilityDelta(isolatedPlayer, ability, situation) !== 0,
    )
  ) {
    return true;
  }

  if (event.type === "serve") {
    return Object.values(
      getServeSpecialAbilityAdjustment(isolatedPlayer, situation),
    ).some((value) => value !== 0);
  }

  return false;
}

export function presentEventSpecialAbilities(
  state: GameState,
  event: MatchEvent,
  bestOfSets: 3 | 5 = 3,
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
  const situation = eventSituation(state, event, player, bestOfSets);
  if (!situation) return [];

  const allowedCategories = new Set(eventCategories);

  return badgesForPlayer(player)
    .filter((ability) => {
      const definition = getSpecialAbilityDefinition(ability.id);
      return (
        definition &&
        allowedCategories.has(definition.category) &&
        hasActiveMatchEffect(player, ability.id, event, situation)
      );
    })
    .slice(0, Math.max(0, limit));
}
