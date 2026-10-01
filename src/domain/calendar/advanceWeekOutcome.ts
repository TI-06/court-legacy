import type { AcademicYearTransitionSummary } from "./academicYearProgression";
import type { MatchStepResult } from "../match/simulateMatch";
import type { Position } from "../model/Player";
import type { PlayerId, SchoolId } from "../model/identifiers";
import type { AbilityKey } from "../validation/gameDataSchema";
import type { AbilityRatingGrade } from "../selectors/ratingGrades";
import type {
  TournamentCircuit,
  TournamentLevel,
  TournamentRound,
} from "../tournament/tournamentTypes";
import type { TrainingResult } from "../training/resolveWeeklyTraining";
export interface MatchTeamPresentation {
  schoolId: SchoolId;
  displayName: string;
  shortName: string;
}
export interface MatchGrowthAbilityPresentation {
  ability: AbilityKey;
  label: string;
  before: number;
  after: number;
  change: number;
  fromGrade: AbilityRatingGrade;
  toGrade: AbilityRatingGrade;
}

export interface MatchGrowthPlayerPresentation {
  playerId: PlayerId;
  displayName: string;
  position: Position;
  abilities: MatchGrowthAbilityPresentation[];
}

export interface MatchGrowthPresentation {
  players: MatchGrowthPlayerPresentation[];
}

export interface PendingMatchPresentation {
  kind: "practice" | "official" | "invitational";
  simulation: MatchStepResult;
  growth?: MatchGrowthPresentation;
  homeTeam: MatchTeamPresentation;
  awayTeam: MatchTeamPresentation;
  official?: {
    tournamentId: string;
    circuit: TournamentCircuit;
    level: TournamentLevel;
    round: TournamentRound;
  };
}
export interface AdvanceWeekOutcome {
  trainingResult?: TrainingResult;
  pendingMatchPresentation: PendingMatchPresentation | null;
  weekAdvanced: boolean;
  academicYearTransition: AcademicYearTransitionSummary | null;
  recoveredPlayerIds: PlayerId[];
  healedPlayerIds: PlayerId[];
}
