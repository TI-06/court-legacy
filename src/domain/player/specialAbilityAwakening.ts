import type { Player } from "../model/Player";
import type {
  EventDefinition,
  EventEffect,
} from "../validation/gameDataSchema";
import { learnSpecialAbility, removeSpecialAbility } from "./specialAbilityProgression";
import { getSpecialAbilityDefinition } from "./specialAbilities";

export type SpecialAbilityAwakeningRarity = "rare" | "super-rare";

export interface SpecialAbilityAwakeningDefinition {
  eventId: string;
  rarity: SpecialAbilityAwakeningRarity;
  targetAbilityId: string;
  consumedAbilityIds: readonly string[];
  event: EventDefinition;
}

function awakeningRarity(
  event: EventDefinition,
): SpecialAbilityAwakeningRarity | null {
  if (event.tags.includes("gold-awakening")) return "super-rare";
  if (event.tags.includes("elite-awakening")) return "rare";
  return null;
}

export function getSpecialAbilityAwakeningDefinition(
  event: EventDefinition,
): SpecialAbilityAwakeningDefinition | null {
  const rarity = awakeningRarity(event);
  if (!rarity || event.actorCount !== 1) return null;

  const awakenChoice = event.choices.find((choice) => choice.id === "awaken");
  if (!awakenChoice) return null;

  const addEffect = awakenChoice.effects.find(
    (
      effect,
    ): effect is Extract<EventEffect, { type: "special-ability-add" }> =>
      effect.type === "special-ability-add",
  );
  if (!addEffect) return null;

  const target = getSpecialAbilityDefinition(addEffect.abilityId);
  if (
    !target ||
    (rarity === "rare" && target.kind !== "elite") ||
    (rarity === "super-rare" && target.kind !== "gold")
  ) {
    return null;
  }

  const consumedAbilityIds = awakenChoice.effects
    .filter(
      (
        effect,
      ): effect is Extract<EventEffect, { type: "special-ability-remove" }> =>
        effect.type === "special-ability-remove",
    )
    .map((effect) => effect.abilityId);

  return {
    eventId: event.id,
    rarity,
    targetAbilityId: addEffect.abilityId,
    consumedAbilityIds,
    event,
  };
}

export function applySpecialAbilityAwakening(
  player: Player,
  awakening: SpecialAbilityAwakeningDefinition,
): Player {
  let current = player;
  for (const abilityId of awakening.consumedAbilityIds) {
    current = removeSpecialAbility(current, abilityId).player;
  }
  return learnSpecialAbility(current, awakening.targetAbilityId).player;
}
