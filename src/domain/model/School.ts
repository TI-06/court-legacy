import type { PlayerId, SchoolId } from "./identifiers";
import type { Position } from "./Player";

export type SchoolReputation =
  | "unknown"
  | "district-contender"
  | "prefectural-power"
  | "national-qualifier"
  | "national-regular"
  | "elite";

export interface UniformColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface SchoolFacilities {
  gym: number;
  trainingRoom: number;
  analysisRoom: number;
  recoveryRoom: number;
  dormitory: number;
  scoutingNetwork: number;
  alumniAssociation: number;
  studyRoom: number;
}

export interface CoachProfile {
  name: string;
  development: number;
  observation: number;
  tactics: number;
  leadership: number;
  charisma: number;
  scouting: number;
  network: number;
  conditioning: number;
}

export interface TeamTactics {
  serveRisk: number;
  serveTargetPlayerId: PlayerId | null;
  attackTempo: "slow" | "balanced" | "fast";
  attackDistribution: Record<Position, number>;
  blockSystem: "read" | "commit" | "mixed";
  defenseBias: "cross" | "balanced" | "line";
}

export interface SchoolHistorySummary {
  seasons: number;
  officialWins: number;
  officialLosses: number;
  prefecturalTitles: number;
  nationalAppearances: number;
  nationalTitles: number;
}

export interface School {
  id: SchoolId;
  name: string;
  shortName: string;
  regionId: string;
  archetypeId: string;
  uniform: UniformColors;
  reputation: SchoolReputation;
  reputationPoints: number;
  funds: number;
  playerIds: PlayerId[];
  alumniPlayerIds: PlayerId[];
  captainPlayerId: PlayerId | null;
  coach: CoachProfile;
  facilities: SchoolFacilities;
  tactics: TeamTactics;
  history: SchoolHistorySummary;
}
