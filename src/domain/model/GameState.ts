import type { TeamDynamicsState } from "../dynamics/teamDynamicsTypes";
import type { ShopGameEffects } from "../shop/shopEffects";
import type {
  OfficialSeasonState,
  TournamentCircuit,
  TournamentLevel,
  TournamentRound,
} from "../tournament/tournamentTypes";
import type { WeeklyScheduleState } from "../weekly/weeklyScheduleTypes";
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
  homeDisplayName?: string;
  awayDisplayName?: string;
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

export interface OfficialTournamentSummary {
  tournamentId: string;
  academicYear: number;
  circuit: TournamentCircuit;
  level: TournamentLevel;
  champion: {
    entrantId: string;
    schoolId: SchoolId | null;
    displayName: string;
  };
  userResult: {
    qualified: boolean;
    bestRound: TournamentRound | null;
    champion: boolean;
  };
}

export interface GameHistory {
  matches: HistoricalMatchSummary[];
  graduates: GraduatedPlayerSummary[];
  nationalChampionSchoolIdsByYear: Record<number, SchoolId>;
  schoolRecordValues: Record<string, number>;
  officialTournaments: OfficialTournamentSummary[];
}

export interface RecruitingState {
  cycleKey: string;
  committedCandidateIds: PlayerId[];
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
  officialSeason: OfficialSeasonState;
  teamDynamics: TeamDynamicsState;
  weeklySchedule: WeeklyScheduleState;
  recruiting?: RecruitingState;
  shopEffects?: ShopGameEffects;
}

export const CURRENT_GAME_SCHEMA_VERSION = 5;

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
    officialTournaments: [],
  };
}

export function relationshipKey(left: PlayerId, right: PlayerId): string {
  return [left, right].sort().join("::");
}
