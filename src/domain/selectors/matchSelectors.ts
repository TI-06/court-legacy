import type { GameState } from "../model/GameState";
import type { Player, PlayerAbilities } from "../model/Player";
import type { School } from "../model/School";
import type { TeamSelection } from "../model/TeamSelection";
import type { PlayerId } from "../model/identifiers";

const ABILITY_KEYS: readonly (keyof PlayerAbilities)[] = [
  "spike",
  "jump",
  "receive",
  "serve",
  "set",
  "block",
  "speed",
  "stamina",
  "decision",
  "mental",
];

function stableTextValue(value: string): number {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total + value.charCodeAt(index) * (index + 1)) % 2_147_483_647;
  }
  return total;
}

function activePlayerIds(selection: TeamSelection): PlayerId[] {
  const ids = selection.rotation.map((assignment) => assignment.playerId);
  if (selection.liberoPlayerId) {
    ids.push(selection.liberoPlayerId);
  }
  return [...new Set(ids)];
}

function playerStrength(player: Player): number {
  const abilityAverage =
    ABILITY_KEYS.reduce(
      (sum, ability) => sum + player.abilities[ability],
      0,
    ) / ABILITY_KEYS.length;
  const conditionAdjustment = (player.condition - 50) * 0.22;
  const fatigueAdjustment = player.fatigue * 0.3;
  const injuryAdjustment = player.injury ? 18 : 0;

  return Math.max(
    1,
    Math.round(
      abilityAverage +
        conditionAdjustment -
        fatigueAdjustment -
        injuryAdjustment,
    ),
  );
}

export function selectPracticeOpponent(state: GameState): School {
  const opponents = Object.values(state.schools)
    .filter((school) => school.id !== state.userSchoolId)
    .sort((first, second) => first.id.localeCompare(second.id));

  if (opponents.length === 0) {
    throw new Error("practice match requires at least one rival school");
  }

  const index =
    (stableTextValue(state.date) + state.yearIndex - 1) % opponents.length;
  return opponents[index]!;
}

export function calculateSelectionStrength(
  state: GameState,
  selection: TeamSelection,
): number {
  const players = activePlayerIds(selection).map((playerId) => {
    const player = state.players[playerId];
    if (!player) {
      throw new Error(`selection references unknown player: ${playerId}`);
    }
    return player;
  });

  if (players.length === 0) {
    return 0;
  }

  return Math.round(
    players.reduce((sum, player) => sum + playerStrength(player), 0) /
      players.length,
  );
}
