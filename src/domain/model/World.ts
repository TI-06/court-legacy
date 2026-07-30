import type { PlayerId, SchoolId } from "./identifiers";

export interface WorldState {
  nextGenerationalTalentYear: number;
  generationalTalentPlayerIds: PlayerId[];
  rivalryScores: Record<string, number>;
  destinyRivalSchoolId?: SchoolId | null;
}
