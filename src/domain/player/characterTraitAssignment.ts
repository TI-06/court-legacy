import type { GameDataRegistry } from "../../data/dataRegistry";
import type { GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function assignCharacterTraitDeterministically(
  seed: string,
  playerId: PlayerId,
  characterTraitIds: readonly string[],
): {
  hiddenTraitIds: string[];
  hiddenTraitAssignmentInitialized: true;
} {
  const ids = [...characterTraitIds].sort((left, right) =>
    left.localeCompare(right),
  );
  if (ids.length === 0) {
    throw new Error("character trait catalog must not be empty");
  }

  const hash = fnv1a32(`${seed}:phase21-character-trait:${playerId}`);
  if (hash % 100 >= 60) {
    return {
      hiddenTraitIds: [],
      hiddenTraitAssignmentInitialized: true,
    };
  }

  return {
    hiddenTraitIds: [ids[Math.floor(hash / 100) % ids.length]!],
    hiddenTraitAssignmentInitialized: true,
  };
}

export function ensureCharacterTraitAssignments(
  state: GameState,
  data: GameDataRegistry,
): GameState {
  const characterTraitIds = [...data.characterTraits.keys()];
  let changed = false;
  const players = { ...state.players };

  for (const player of Object.values(state.players)) {
    if (player.hiddenTraitAssignmentInitialized === true) {
      continue;
    }

    players[player.id] = {
      ...player,
      ...assignCharacterTraitDeterministically(
        state.seed,
        player.id,
        characterTraitIds,
      ),
    };
    changed = true;
  }

  return changed ? { ...state, players } : state;
}
