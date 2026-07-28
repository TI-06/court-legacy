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
  | "duplicate-player"
  | "libero-in-rotation"
  | "bench-overlap"
  | "serving-order-mismatch";

export interface TeamSelectionIssue {
  code: TeamSelectionIssueCode;
  playerId: PlayerId | null;
  message: string;
}
