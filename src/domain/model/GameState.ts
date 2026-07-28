import type { CalendarState } from "./Calendar";
import type { EventMemory, PendingEvent } from "./Event";
import type { GameDate, MatchId, PlayerId, SchoolId } from "./identifiers";
import type { MatchState } from "./Match";
import type { Player } from "./Player";
import type { School } from "./School";

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
  calendar: CalendarState;
  activeMatch: MatchState | null;
  pendingEvent: PendingEvent | null;
  history: GameHistory;
  eventMemory: EventMemory;
  settings: GameSettings;
}

export const CURRENT_GAME_SCHEMA_VERSION = 1;

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
