import type { GameDataRegistry } from "../../data/dataRegistry";
import type { GameState } from "../model/GameState";
import type { Player } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { SpecialRelationshipKind } from "../relationships/relationshipTypes";
import type { CharacterTraitDefinition } from "../validation/gameDataSchema";

export interface CharacterTraitDiscoveryContext {
  eventTags?: readonly string[];
  captainPlayerId?: PlayerId | null;
  viceCaptainPlayerId?: PlayerId | null;
}

export interface CharacterTraitDiscovery {
  playerId: PlayerId;
  traitId: string;
}

type DiscoveryCondition =
  CharacterTraitDefinition["discoveryConditions"][number];

function hasSpecialRelationship(
  state: GameState,
  playerId: PlayerId,
  kind?: SpecialRelationshipKind,
): boolean {
  return Object.values(state.playerRelationshipBonds).some(
    (bond) =>
      bond.playerIds.includes(playerId) &&
      bond.tags.some((tag) => kind === undefined || tag.kind === kind),
  );
}

function conditionMatches(
  state: GameState,
  player: Player,
  condition: DiscoveryCondition,
  context: CharacterTraitDiscoveryContext,
): boolean {
  switch (condition.type) {
    case "trust-min":
      return player.trust >= condition.value;
    case "appearances-min":
      return player.career.appearances >= condition.value;
    case "captaincy":
      return (
        player.id === context.captainPlayerId ||
        player.id === context.viceCaptainPlayerId
      );
    case "special-relationship":
      return hasSpecialRelationship(state, player.id, condition.kind);
    case "event-tag":
      return context.eventTags?.includes(condition.tag) ?? false;
  }
}

export function discoverEligibleCharacterTraits(
  state: GameState,
  data: GameDataRegistry,
  context: CharacterTraitDiscoveryContext = {},
): { state: GameState; discoveries: CharacterTraitDiscovery[] } {
  const players = { ...state.players };
  const discoveries: CharacterTraitDiscovery[] = [];
  let changed = false;

  for (const playerId of Object.keys(state.players).sort()) {
    const player = state.players[playerId as PlayerId];
    if (!player) continue;
    const hidden = [...new Set(player.hiddenTraitIds)].sort();
    const hiddenSet = new Set(hidden);
    const revealed = [...new Set(player.revealedHiddenTraitIds ?? [])]
      .filter((traitId) => hiddenSet.has(traitId))
      .sort();
    const revealedSet = new Set(revealed);

    for (const traitId of hidden) {
      if (revealedSet.has(traitId)) continue;
      const trait = data.characterTraits.get(traitId);
      if (!trait) continue;
      if (
        !trait.discoveryConditions.some((condition) =>
          conditionMatches(state, player, condition, context),
        )
      ) {
        continue;
      }
      revealedSet.add(traitId);
      discoveries.push({ playerId: player.id, traitId });
    }

    const nextRevealed = [...revealedSet].sort();
    const previousRevealed = player.revealedHiddenTraitIds ?? [];
    const needsUpdate =
      previousRevealed.length !== nextRevealed.length ||
      previousRevealed.some(
        (traitId, index) => traitId !== nextRevealed[index],
      );
    if (needsUpdate) {
      players[player.id] = {
        ...player,
        revealedHiddenTraitIds: nextRevealed,
      };
      changed = true;
    }
  }

  discoveries.sort(
    (left, right) =>
      left.playerId.localeCompare(right.playerId) ||
      left.traitId.localeCompare(right.traitId),
  );
  return {
    state: changed ? { ...state, players } : state,
    discoveries,
  };
}
