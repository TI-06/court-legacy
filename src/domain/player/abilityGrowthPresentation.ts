import type { GameState } from "../model/GameState";
import type { Player, Position } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import {
  ratingToGrade,
  type AbilityRatingGrade,
} from "../selectors/ratingGrades";
import type { AbilityKey } from "../validation/gameDataSchema";

export interface AbilityValueChange {
  ability: AbilityKey;
  before: number;
  after: number;
  delta: number;
  beforeGrade: AbilityRatingGrade;
  afterGrade: AbilityRatingGrade;
}

export interface PlayerAbilityGrowthPresentation {
  playerId: PlayerId;
  displayName: string;
  grade: number;
  preferredPosition: Position;
  totalAbilityGrowth: number;
  changes: AbilityValueChange[];
}

export interface MatchGrowthPresentation {
  totalAbilityGrowth: number;
  players: PlayerAbilityGrowthPresentation[];
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

function clampRating(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function valueChange(
  ability: AbilityKey,
  before: number,
  after: number,
): AbilityValueChange | null {
  const from = clampRating(before);
  const to = clampRating(after);
  const delta = to - from;
  if (delta === 0) return null;

  return {
    ability,
    before: from,
    after: to,
    delta,
    beforeGrade: ratingToGrade(from),
    afterGrade: ratingToGrade(to),
  };
}

export function buildAbilityValueChanges(
  player: Player,
  abilityChanges: Partial<Record<AbilityKey, number>>,
): AbilityValueChange[] {
  return abilityKeys.flatMap((ability) => {
    const delta = abilityChanges[ability] ?? 0;
    if (delta === 0) return [];
    const before = player.abilities[ability];
    const change = valueChange(ability, before, before + delta);
    return change ? [change] : [];
  });
}

export function buildMatchGrowthPresentation(
  beforeState: GameState,
  afterState: GameState,
): MatchGrowthPresentation {
  const school = afterState.schools[afterState.userSchoolId];
  if (!school) {
    return { totalAbilityGrowth: 0, players: [] };
  }

  const players = school.playerIds.flatMap((playerId) => {
    const beforePlayer = beforeState.players[playerId];
    const afterPlayer = afterState.players[playerId];
    if (!beforePlayer || !afterPlayer) return [];

    const changes = abilityKeys.flatMap((ability) => {
      const change = valueChange(
        ability,
        beforePlayer.abilities[ability],
        afterPlayer.abilities[ability],
      );
      return change ? [change] : [];
    });
    if (changes.length === 0) return [];

    return [
      {
        playerId,
        displayName: `${afterPlayer.lastName} ${afterPlayer.firstName}`,
        grade: afterPlayer.grade,
        preferredPosition: afterPlayer.preferredPosition,
        totalAbilityGrowth: changes.reduce(
          (total, change) => total + Math.max(0, change.delta),
          0,
        ),
        changes,
      } satisfies PlayerAbilityGrowthPresentation,
    ];
  });

  return {
    totalAbilityGrowth: players.reduce(
      (total, player) => total + player.totalAbilityGrowth,
      0,
    ),
    players,
  };
}
