import type { GameState } from "../../domain/model/GameState";
import type { PlayerId } from "../../domain/model/identifiers";
import type { AbilityKey } from "../../domain/validation/gameDataSchema";
import { ratingToGrade } from "../../domain/selectors/ratingGrades";

export interface MatchGrowthAbilityChange {
  ability: AbilityKey;
  before: number;
  after: number;
  fromGrade: ReturnType<typeof ratingToGrade>;
  toGrade: ReturnType<typeof ratingToGrade>;
}

export interface MatchGrowthPlayerSummary {
  playerId: PlayerId;
  displayName: string;
  preferredPosition: string;
  changes: MatchGrowthAbilityChange[];
}

export interface MatchGrowthSummary {
  players: MatchGrowthPlayerSummary[];
}

const abilityKeys: readonly AbilityKey[] = [
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

export function buildMatchGrowthSummary(
  before: GameState,
  after: GameState,
): MatchGrowthSummary | null {
  const school = after.schools[after.userSchoolId];
  if (!school) return null;

  const players = school.playerIds.flatMap((playerId) => {
    const beforePlayer = before.players[playerId];
    const afterPlayer = after.players[playerId];
    if (!beforePlayer || !afterPlayer) return [];

    const changes = abilityKeys.flatMap((ability) => {
      const beforeValue = beforePlayer.abilities[ability];
      const afterValue = afterPlayer.abilities[ability];
      if (beforeValue === afterValue) return [];

      return [
        {
          ability,
          before: beforeValue,
          after: afterValue,
          fromGrade: ratingToGrade(beforeValue),
          toGrade: ratingToGrade(afterValue),
        },
      ];
    });

    if (changes.length === 0) return [];

    return [
      {
        playerId,
        displayName: `${afterPlayer.lastName} ${afterPlayer.firstName}`,
        preferredPosition: afterPlayer.preferredPosition,
        changes,
      },
    ];
  });

  return players.length > 0 ? { players } : null;
}
