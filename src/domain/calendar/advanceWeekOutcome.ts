import type { AcademicYearTransitionSummary } from "./academicYearProgression";
import type { SimulateMatchResult } from "../match/simulateMatch";
import type { PlayerId, SchoolId } from "../model/identifiers";
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
export interface PendingMatchPresentation {
  kind: "practice" | "official";
  simulation: SimulateMatchResult;
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
