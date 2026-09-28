import type { GameState } from "../../domain/model/GameState";
import { ABILITY_KEYS } from "../../domain/model/Player";
import type { PlayerId } from "../../domain/model/identifiers";
import { ratingToGrade } from "../../domain/selectors/ratingGrades";
import type { AbilityKey } from "../../domain/validation/gameDataSchema";

export interface MatchGrowthAbilityRow {
  ability: AbilityKey;
  before: number;
  after: number;
  delta: number;
  beforeGrade: string;
  afterGrade: string;
}

export interface MatchGrowthPlayerRow {
  playerId: PlayerId;
  displayName: string;
  grade: number;
  preferredPosition: string;
  abilities: MatchGrowthAbilityRow[];
}

export interface MatchGrowthSummary {
  players: MatchGrowthPlayerRow[];
}

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

    const abilities = ABILITY_KEYS.flatMap((ability) => {
      const beforeValue = beforePlayer.abilities[ability];
      const afterValue = afterPlayer.abilities[ability];
      const delta = afterValue - beforeValue;
      if (delta === 0) return [];

      return [
        {
          ability,
          before: beforeValue,
          after: afterValue,
          delta,
          beforeGrade: ratingToGrade(beforeValue),
          afterGrade: ratingToGrade(afterValue),
        } satisfies MatchGrowthAbilityRow,
      ];
    });

    if (abilities.length === 0) return [];

    return [
      {
        playerId,
        displayName: `${afterPlayer.lastName} ${afterPlayer.firstName}`,
        grade: afterPlayer.grade,
        preferredPosition: afterPlayer.preferredPosition,
        abilities,
      } satisfies MatchGrowthPlayerRow,
    ];
  });

  return players.length > 0 ? { players } : null;
}
