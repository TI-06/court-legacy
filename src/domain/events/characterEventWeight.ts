import type { GameDataRegistry } from "../../data/dataRegistry";
import { relationshipKey, type GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";
import type { EventDefinition } from "../validation/gameDataSchema";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, Math.round(value)));

function intersects(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

function isRelationshipCategory(event: EventDefinition): boolean {
  return event.category === "relationship" || event.category === "rivalry";
}

function bondMatchesEvent(
  state: GameState,
  event: EventDefinition,
  actorPlayerIds: readonly PlayerId[],
): boolean {
  if (actorPlayerIds.length !== 2 || actorPlayerIds[0] === actorPlayerIds[1]) {
    return false;
  }
  const bond =
    state.playerRelationshipBonds[
      relationshipKey(actorPlayerIds[0]!, actorPlayerIds[1]!)
    ];
  if (!bond) return false;
  const tags = new Set(event.tags);
  return bond.tags.some((tag) => {
    if (tag.kind === "rival") {
      return (
        event.category === "rivalry" ||
        tags.has("competition") ||
        tags.has("rivalry")
      );
    }
    if (tag.kind === "mentor") {
      return tags.has("mentor") || tags.has("guidance");
    }
    return (
      tags.has("pair") || tags.has("cooperation") || tags.has("coordination")
    );
  });
}

export function characterEventWeightMultiplier(
  state: GameState,
  data: GameDataRegistry,
  event: EventDefinition,
  actorPlayerIds: readonly PlayerId[],
): number {
  let score = 100;
  let personalityTagBonus = 0;
  let personalityRelationshipBias = 0;
  let characterTraitTagBonus = 0;
  let characterTraitRelationshipBias = 0;
  const relationshipCategory = isRelationshipCategory(event);

  for (const actorId of actorPlayerIds) {
    const player = state.players[actorId];
    if (!player) continue;

    const personality = data.personalities.get(player.personalityId);
    if (personality) {
      if (intersects(personality.tags, event.tags)) {
        personalityTagBonus += 10;
      }
      if (relationshipCategory) {
        personalityRelationshipBias += Math.round(
          personality.relationshipGrowth / 2,
        );
      }
    }

    for (const traitId of player.revealedHiddenTraitIds ?? []) {
      const trait = data.characterTraits.get(traitId);
      if (!trait) continue;
      if (intersects(trait.eventTags, event.tags)) {
        characterTraitTagBonus += 15;
      }
      if (relationshipCategory) {
        characterTraitRelationshipBias += trait.relationshipBias;
      }
    }
  }

  score += Math.min(20, personalityTagBonus);
  score += relationshipCategory
    ? clamp(personalityRelationshipBias, -15, 15)
    : 0;
  score += Math.min(30, characterTraitTagBonus);
  score += relationshipCategory
    ? clamp(characterTraitRelationshipBias, -15, 15)
    : 0;
  if (bondMatchesEvent(state, event, actorPlayerIds)) {
    score += 20;
  }
  return clamp(score, 75, 150);
}
