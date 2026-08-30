import type { PlayerId } from "../model/identifiers";

export type PlayerRole =
  "ace" | "starter" | "rotation" | "development" | "reserve";

export type CohesionTrend = "rising" | "stable" | "falling";

export type PlayerConcernCode =
  "playing-time" | "role-mismatch" | "injury-overuse" | "team-slump";

export interface PlayerConcern {
  code: PlayerConcernCode;
  severity: 1 | 2 | 3;
}

export interface TeamDynamicsState {
  captainPlayerId: PlayerId | null;
  viceCaptainPlayerId: PlayerId | null;
  cohesion: number;
  previousCohesion: number;
  cohesionTrend: CohesionTrend;
  playerRoles: Partial<Record<PlayerId, PlayerRole>>;
  playerConcerns: Partial<Record<PlayerId, PlayerConcern[]>>;
  lineupContinuity: number;
  recentOfficialStarterCounts: Partial<Record<PlayerId, number>>;
  recentOfficialMatchesTracked: number;
}
