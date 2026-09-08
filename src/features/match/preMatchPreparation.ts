import { isWeeklyActionCompleted } from "../../domain/calendar/weekProgression";
import type { GameState } from "../../domain/model/GameState";
import { calculateSelectionStrength } from "../../domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../domain/team/autoSelectTeam";
import { selectNextOfficialEvent } from "../../domain/tournament/tournamentSelectors";

export interface WeekPreMatchPreparation {
  kind: "official" | "practice";
  opponentName: string;
  opponentStrength?: number;
}

function strengthForSchool(state: GameState, schoolId: string): number | undefined {
  const school = state.schools[schoolId];
  if (!school) return undefined;
  const selection = autoSelectTeam({ state, schoolId: school.id });
  return calculateSelectionStrength(state, selection);
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
        ? {
            opponentStrength: strengthForSchool(
              state,
              nextOfficial.opponent.schoolId,
            ),
          }
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
      opponentStrength: strengthForSchool(state, opponent.id),
    };
  }

  return null;
}
