import type { SchoolId } from "../model/identifiers";

export type TournamentCircuit = "interhigh" | "spring-high";
export type TournamentLevel = "prefectural" | "national";
export type TournamentRound =
  | "round-of-16"
  | "quarterfinal"
  | "semifinal"
  | "final";
export type TournamentMatchStatus =
  | "waiting"
  | "ready"
  | "user-required"
  | "completed";

export interface WorldSchoolTournamentEntrant {
  entrantId: string;
  source: "world-school";
  schoolId: SchoolId;
  displayName: string;
  shortName: string;
  seedStrength: number;
}

export interface GuestTournamentEntrant {
  entrantId: string;
  source: "guest-representative";
  displayName: string;
  shortName: string;
  regionLabel: string;
  guestSeed: string;
  seedStrength: number;
}

export type TournamentEntrant =
  | WorldSchoolTournamentEntrant
  | GuestTournamentEntrant;

export interface TournamentBracketMatch {
  id: string;
  round: TournamentRound;
  roundIndex: number;
  slotIndex: number;
  scheduledWeek: number;
  homeEntrantId: string | null;
  awayEntrantId: string | null;
  winnerEntrantId: string | null;
  homeSetsWon: number | null;
  awaySetsWon: number | null;
  status: TournamentMatchStatus;
}

export interface TournamentStageState {
  tournamentId: string;
  circuit: TournamentCircuit;
  level: TournamentLevel;
  entrants: TournamentEntrant[];
  matches: TournamentBracketMatch[];
  championEntrantId: string | null;
  userEliminated: boolean;
  userBestRound: TournamentRound | null;
}

export interface OfficialCircuitState {
  prefectural: TournamentStageState;
  national: TournamentStageState | null;
}

export interface OfficialSeasonState {
  academicYear: number;
  interhigh: OfficialCircuitState;
  springHigh: OfficialCircuitState;
}
