import type { PlayerId } from "./identifiers";

export type RotationSlot = 1 | 2 | 3 | 4 | 5 | 6;

export interface RotationAssignment {
  slot: RotationSlot;
  playerId: PlayerId;
}

export interface SubstitutionPolicy {
  starterLockPlayerIds: PlayerId[];
  allowFatigueBenching: boolean;
  allowInjuryBenching: boolean;
  automaticSubstitutions: boolean;
  automaticSetChanges: boolean;
}

export interface TeamSelection {
  rotation: RotationAssignment[];
  liberoPlayerId: PlayerId | null;
  benchPlayerIds: PlayerId[];
  servingOrderPlayerIds: PlayerId[];
  substitutionPolicy: SubstitutionPolicy;
}

export type TeamSelectionIssueCode =
  | "rotation-size"
  | "invalid-slot"
  | "duplicate-player"
  | "libero-in-rotation"
  | "bench-overlap"
  | "duplicate-bench-player"
  | "serving-order-mismatch"
  | "unknown-player"
  | "player-not-in-school"
  | "invalid-starter-lock";

export interface TeamSelectionIssue {
  code: TeamSelectionIssueCode;
  playerId: PlayerId | null;
  message: string;
}
