import type { CalendarState } from "./Calendar";
import type { EventMemory, PendingEvent } from "./Event";
import type { GameDate, MatchId, PlayerId, SchoolId } from "./identifiers";
import type { MatchState } from "./Match";
import type { Player } from "./Player";
import type { School } from "./School";
import type { WorldState } from "./World";

export interface GameSettings {
  matchDisplayMode: "normal" | "fast" | "text" | "instant";
  matchPlaybackSpeed: 1 | 2 | 4;
  reducedMotion: boolean;
  confirmBeforeOfficialMatch: boolean;
  autosaveEnabled: boolean;
}

export interface HistoricalMatchSummary {
  matchId: MatchId;
  date: GameDate;
  homeSchoolId: SchoolId;
  awaySchoolId: SchoolId;
  winnerSchoolId: SchoolId;
  homeSetsWon: number;
  awaySetsWon: number;
  tournamentId: string | null;
}

export interface GraduatedPlayerSummary {
  playerId: PlayerId;
  schoolId: SchoolId;
  graduationYear: number;
  displayName: string;
  position: string;
  appearances: number;
  points: number;
  blocks: number;
  serviceAces: number;
  awardIds: string[];
}

export interface GameHistory {
  matches: HistoricalMatchSummary[];
  graduates: GraduatedPlayerSummary[];
  nationalChampionSchoolIdsByYear: Record<number, SchoolId>;
  schoolRecordValues: Record<string, number>;
}

export interface GameState {
  schemaVersion: number;
  seed: string;
  randomCursor: number;
  date: GameDate;
  yearIndex: number;
  userSchoolId: SchoolId;
  schools: Record<SchoolId, School>;
  players: Record<PlayerId, Player>;
  playerRelationships: Record<string, number>;
  calendar: CalendarState;
  activeMatch: MatchState | null;
  pendingEvent: PendingEvent | null;
  history: GameHistory;
  eventMemory: EventMemory;
  settings: GameSettings;
  world: WorldState;
}

export const CURRENT_GAME_SCHEMA_VERSION = 2;

export function createDefaultGameSettings(): GameSettings {
  return {
    matchDisplayMode: "normal",
    matchPlaybackSpeed: 1,
    reducedMotion: false,
    confirmBeforeOfficialMatch: true,
    autosaveEnabled: true,
  };
}

export function createEmptyGameHistory(): GameHistory {
  return {
    matches: [],
    graduates: [],
    nationalChampionSchoolIdsByYear: {},
    schoolRecordValues: {},
  };
}

export function relationshipKey(left: PlayerId, right: PlayerId): string {
  return [left, right].sort().join("::");
}
