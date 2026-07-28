import type { PlayerId } from "./identifiers";

export interface WorldState {
  nextGenerationalTalentYear: number;
  generationalTalentPlayerIds: PlayerId[];
  rivalryScores: Record<string, number>;
}
