import type {
  GameState,
  GraduatedPlayerSummary,
} from "../../domain/model/GameState";
import type { Player, Position } from "../../domain/model/Player";
import type { PlayerId } from "../../domain/model/identifiers";

export type LegacyLeaderboardCategory =
  "appearances" | "points" | "blocks" | "service-aces";

export interface LegacyLeaderboardRow {
  playerId: PlayerId;
  displayName: string;
  position: Position | string;
  value: number;
  valueLabel: string;
  statusLabel: string;
  active: boolean;
}

export interface LegacyLeaderboardSection {
  id: LegacyLeaderboardCategory;
  label: string;
  rows: LegacyLeaderboardRow[];
}

export interface SchoolLegacyLeaderboardPresentation {
  hasRecords: boolean;
  recordHolderCount: number;
  sections: LegacyLeaderboardSection[];
}

interface LegacySource {
  playerId: PlayerId;
  displayName: string;
  position: Position | string;
  appearances: number;
  points: number;
  blocks: number;
  serviceAces: number;
  statusLabel: string;
  active: boolean;
}

function activeSource(player: Player): LegacySource {
  return {
    playerId: player.id,
    displayName: `${player.lastName} ${player.firstName}`,
    position: player.preferredPosition,
    appearances: player.career.appearances,
    points: player.career.points,
    blocks: player.career.blocks,
    serviceAces: player.career.serviceAces,
    statusLabel: `${player.grade}年・現役`,
    active: true,
  };
}

function graduateSource(player: GraduatedPlayerSummary): LegacySource {
  return {
    playerId: player.playerId,
    displayName: player.displayName,
    position: player.position,
    appearances: player.appearances,
    points: player.points,
    blocks: player.blocks,
    serviceAces: player.serviceAces,
    statusLabel: `${player.graduationYear}年卒`,
    active: false,
  };
}

function section(
  sources: readonly LegacySource[],
  id: LegacyLeaderboardCategory,
  label: string,
): LegacyLeaderboardSection {
  const rows = sources
    .map((source) => ({
      playerId: source.playerId,
      displayName: source.displayName,
      position: source.position,
      value:
        id === "appearances"
          ? source.appearances
          : id === "points"
            ? source.points
            : id === "blocks"
              ? source.blocks
              : source.serviceAces,
      valueLabel: "",
      statusLabel: source.statusLabel,
      active: source.active,
    }))
    .filter((row) => row.value > 0)
    .sort(
      (left, right) =>
        right.value - left.value ||
        Number(right.active) - Number(left.active) ||
        left.playerId.localeCompare(right.playerId),
    )
    .slice(0, 5)
    .map((row) => ({
      ...row,
      valueLabel: String(row.value),
    }));

  return { id, label, rows };
}

export function buildSchoolLegacyLeaderboard(
  state: GameState,
): SchoolLegacyLeaderboardPresentation {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error(`user school not found: ${state.userSchoolId}`);
  }

  const activePlayers = school.playerIds
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => Boolean(player))
    .map(activeSource);
  const graduates = state.history.graduates
    .filter((player) => player.schoolId === state.userSchoolId)
    .map(graduateSource);
  const sources = [...activePlayers, ...graduates];

  const sections = [
    section(sources, "appearances", "出場試合"),
    section(sources, "points", "通算得点"),
    section(sources, "blocks", "通算ブロック"),
    section(sources, "service-aces", "サービスエース"),
  ];

  return {
    hasRecords: sections.some((item) => item.rows.length > 0),
    recordHolderCount: new Set(
      sections.flatMap((item) => item.rows.map((row) => row.playerId)),
    ).size,
    sections,
  };
}
