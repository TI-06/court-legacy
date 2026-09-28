import type { GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";
import type { AbilityKey } from "../validation/gameDataSchema";
import {
  ratingToGrade,
  type AbilityRatingGrade,
} from "../selectors/ratingGrades";

export interface MatchAbilityGrowthRow {
  ability: AbilityKey;
  before: number;
  after: number;
  beforeGrade: AbilityRatingGrade;
  afterGrade: AbilityRatingGrade;
  change: number;
}

export interface MatchPlayerGrowthRow {
  playerId: PlayerId;
  displayName: string;
  preferredPosition: string;
  changes: MatchAbilityGrowthRow[];
}

const abilityOrder: readonly AbilityKey[] = [
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

export function buildMatchGrowthRows(
  before: GameState,
  after: GameState,
): MatchPlayerGrowthRow[] {
  const school = after.schools[after.userSchoolId];
  if (!school) return [];

  return school.playerIds.flatMap((playerId) => {
    const beforePlayer = before.players[playerId];
    const afterPlayer = after.players[playerId];
    if (!beforePlayer || !afterPlayer) return [];

    const changes = abilityOrder.flatMap((ability) => {
      const previous = beforePlayer.abilities[ability];
      const next = afterPlayer.abilities[ability];
      if (previous === next) return [];
      return [
        {
          ability,
          before: previous,
          after: next,
          beforeGrade: ratingToGrade(previous),
          afterGrade: ratingToGrade(next),
          change: next - previous,
        } satisfies MatchAbilityGrowthRow,
      ];
    });

    if (changes.length === 0) return [];
    return [
      {
        playerId,
        displayName: `${afterPlayer.lastName} ${afterPlayer.firstName}`,
        preferredPosition: afterPlayer.preferredPosition,
        changes,
      } satisfies MatchPlayerGrowthRow,
    ];
  });
}
