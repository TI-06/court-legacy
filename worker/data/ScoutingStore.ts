import type { Player } from "../../src/domain/model/Player";
import type { PlayerId } from "../../src/domain/model/identifiers";
import type {
  MiddleSchoolAchievement,
  OverallScoutPrecision,
  PotentialScoutPrecision,
} from "../../src/domain/scouting/scoutReport";

export interface ScoutingCandidateTruth {
  player: Player;
  middleSchoolAchievement: MiddleSchoolAchievement;
}

export interface ScoutingCandidateInsight {
  candidateId: PlayerId;
  overallPrecision: OverallScoutPrecision;
  potentialPrecision: PotentialScoutPrecision;
}

export interface ScoutingCandidatePool {
  userId: string;
  cycleKey: string;
  creationOperationId: string;
  candidates: ScoutingCandidateTruth[];
}

export interface CreateScoutingCandidatePoolInput {
  userId: string;
  cycleKey: string;
  creationOperationId: string;
  candidates: ScoutingCandidateTruth[];
}

export interface ScoutingStore {
  getCandidatePool(
    userId: string,
    cycleKey: string,
  ): Promise<ScoutingCandidatePool | null>;
  createCandidatePool(
    input: CreateScoutingCandidatePoolInput,
  ): Promise<ScoutingCandidatePool>;
  listCandidateInsights(
    userId: string,
    cycleKey: string,
  ): Promise<ScoutingCandidateInsight[]>;
}
