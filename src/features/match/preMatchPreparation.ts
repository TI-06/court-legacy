import { isWeeklyActionCompleted } from "../../domain/calendar/weekProgression";
import type { GameState } from "../../domain/model/GameState";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import { calculateSelectionStrength } from "../../domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../domain/team/autoSelectTeam";
import { selectNextOfficialEvent } from "../../domain/tournament/tournamentSelectors";

export interface WeekPreMatchPreparation {
  kind: "official" | "practice";
  opponentName: string;
  opponentStrength?: number;
  opponentSelection?: TeamSelection;
}

function preparationForSchool(
  state: GameState,
  schoolId: string,
): Pick<WeekPreMatchPreparation, "opponentStrength" | "opponentSelection"> {
  const school = state.schools[schoolId];
  if (!school) return {};
  const opponentSelection = autoSelectTeam({ state, schoolId: school.id });
  return {
    opponentSelection,
    opponentStrength: calculateSelectionStrength(state, opponentSelection),
  };
}

export function selectWeekPreMatchPreparation(
  state: GameState,
): WeekPreMatchPreparation | null {
  const nextOfficial = selectNextOfficialEvent(state);
  if (
    nextOfficial?.kind === "match" &&
    nextOfficial.timing === "due" &&
    nextOfficial.weeksUntil === 0
  ) {
    return {
      kind: "official",
      opponentName: nextOfficial.opponent.displayName,
      ...(nextOfficial.opponent.schoolId
        ? preparationForSchool(state, nextOfficial.opponent.schoolId)
        : {}),
    };
  }

  const practice = state.weeklySchedule.practiceMatch;
  if (
    practice.scheduledOpponentId &&
    !isWeeklyActionCompleted(state, "practice-match")
  ) {
    const opponent = state.schools[practice.scheduledOpponentId];
    if (!opponent) return null;
    return {
      kind: "practice",
      opponentName: opponent.name,
      ...preparationForSchool(state, opponent.id),
    };
  }

  return null;
}
