import type {
  GameState,
  OfficialTournamentSummary,
} from "../model/GameState";
import type {
  TournamentEntrant,
  TournamentStageState,
} from "./tournamentTypes";

export const MAX_OFFICIAL_TOURNAMENT_HISTORY = 400;

function championEntrant(stage: TournamentStageState): TournamentEntrant {
  if (!stage.championEntrantId) {
    throw new Error("cannot archive an unfinished tournament stage");
  }
  const champion = stage.entrants.find(
    (entrant) => entrant.entrantId === stage.championEntrantId,
  );
  if (!champion) {
    throw new Error("tournament champion is not present in the entrant list");
  }
  return champion;
}

function buildSummary(
  state: GameState,
  stage: TournamentStageState,
): OfficialTournamentSummary {
  const champion = championEntrant(stage);
  const userEntrant = stage.entrants.find(
    (entrant) =>
      entrant.source === "world-school" &&
      entrant.schoolId === state.userSchoolId,
  );

  return {
    tournamentId: stage.tournamentId,
    academicYear: state.officialSeason.academicYear,
    circuit: stage.circuit,
    level: stage.level,
    champion: {
      entrantId: champion.entrantId,
      schoolId: champion.source === "world-school" ? champion.schoolId : null,
      displayName: champion.displayName,
    },
    userResult: {
      qualified: Boolean(userEntrant),
      bestRound: stage.userBestRound,
      champion: userEntrant?.entrantId === champion.entrantId,
    },
  };
}

export function appendOfficialTournamentSummary(
  state: GameState,
  stage: TournamentStageState,
): GameState {
  if (
    state.history.officialTournaments.some(
      (summary) => summary.tournamentId === stage.tournamentId,
    )
  ) {
    return state;
  }

  const summary = buildSummary(state, stage);
  return {
    ...state,
    history: {
      ...state.history,
      officialTournaments: [
        ...state.history.officialTournaments,
        summary,
      ].slice(-MAX_OFFICIAL_TOURNAMENT_HISTORY),
    },
  };
}
