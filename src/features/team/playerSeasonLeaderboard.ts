import type { GameState } from "../../domain/model/GameState";
import type {
  Player,
  PlayerSeasonStats,
  Position,
} from "../../domain/model/Player";
import type { PlayerId } from "../../domain/model/identifiers";

export type SeasonLeaderboardCategory =
  "points" | "blocks" | "service-aces" | "attack-rate" | "receive-rate";

export interface SeasonLeaderboardRow {
  playerId: PlayerId;
  displayName: string;
  position: Position;
  value: number;
  valueLabel: string;
  sampleSize: number;
}

export interface SeasonLeaderboardSection {
  id: SeasonLeaderboardCategory;
  label: string;
  rows: SeasonLeaderboardRow[];
}

export interface TeamSeasonLeaderboardPresentation {
  academicYear: number;
  hasOfficialStats: boolean;
  totalAppearances: number;
  sections: SeasonLeaderboardSection[];
}

function currentStats(
  player: Player,
  academicYear: number,
): PlayerSeasonStats | null {
  return player.career.seasonStats?.academicYear === academicYear
    ? player.career.seasonStats
    : null;
}

function percentage(numerator: number, denominator: number): number {
  return denominator <= 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function displayName(player: Player): string {
  return `${player.lastName} ${player.firstName}`;
}

function numericRows(
  players: readonly Player[],
  academicYear: number,
  category: "points" | "blocks" | "service-aces",
  label: string,
): SeasonLeaderboardSection {
  const rows = players
    .map((player) => {
      const stats = currentStats(player, academicYear);
      const value =
        category === "points"
          ? (stats?.points ?? 0)
          : category === "blocks"
            ? (stats?.blocks ?? 0)
            : (stats?.serviceAces ?? 0);
      return {
        playerId: player.id,
        displayName: displayName(player),
        position: player.preferredPosition,
        value,
        valueLabel: String(value),
        sampleSize: stats?.appearances ?? 0,
      } satisfies SeasonLeaderboardRow;
    })
    .filter((row) => row.value > 0)
    .sort(
      (left, right) =>
        right.value - left.value ||
        right.sampleSize - left.sampleSize ||
        left.playerId.localeCompare(right.playerId),
    )
    .slice(0, 3);

  return { id: category, label, rows };
}

function rateRows(
  players: readonly Player[],
  academicYear: number,
  category: "attack-rate" | "receive-rate",
  label: string,
): SeasonLeaderboardSection {
  const rows = players
    .map((player) => {
      const stats = currentStats(player, academicYear);
      const numerator =
        category === "attack-rate"
          ? (stats?.attackPoints ?? 0)
          : (stats?.perfectReceives ?? 0);
      const denominator =
        category === "attack-rate"
          ? (stats?.attackAttempts ?? 0)
          : (stats?.receiveAttempts ?? 0);
      const value = percentage(numerator, denominator);
      return {
        playerId: player.id,
        displayName: displayName(player),
        position: player.preferredPosition,
        value,
        valueLabel: `${value}%`,
        sampleSize: denominator,
      } satisfies SeasonLeaderboardRow;
    })
    .filter((row) => row.sampleSize >= 5)
    .sort(
      (left, right) =>
        right.value - left.value ||
        right.sampleSize - left.sampleSize ||
        left.playerId.localeCompare(right.playerId),
    )
    .slice(0, 3);

  return { id: category, label, rows };
}

export function buildTeamSeasonLeaderboard(
  state: GameState,
): TeamSeasonLeaderboardPresentation {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error(`user school not found: ${state.userSchoolId}`);
  }

  const academicYear = state.calendar.academicYear;
  const players = school.playerIds
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => Boolean(player));
  const totalAppearances = players.reduce(
    (total, player) =>
      total + (currentStats(player, academicYear)?.appearances ?? 0),
    0,
  );

  return {
    academicYear,
    hasOfficialStats: totalAppearances > 0,
    totalAppearances,
    sections: [
      numericRows(players, academicYear, "points", "得点"),
      numericRows(players, academicYear, "blocks", "ブロック"),
      numericRows(players, academicYear, "service-aces", "サービスエース"),
      rateRows(players, academicYear, "attack-rate", "アタック決定率"),
      rateRows(players, academicYear, "receive-rate", "好レシーブ率"),
    ],
  };
}
