import type { WeeklyPlan } from "../training/resolveWeeklyTraining";
import {
  buildInitialPracticePlanning,
  type PracticePlanningSource,
} from "./practiceMatchPlanning";
import type { WeeklyScheduleState } from "./weeklyScheduleTypes";

type WeeklyScheduleSource = PracticePlanningSource;

export function createDefaultWeeklyPlan(
  state: Pick<WeeklyScheduleSource, "userSchoolId" | "schools">,
): WeeklyPlan {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error("weekly schedule requires the user school");
  }
  if (school.playerIds.length === 0) {
    throw new Error("weekly schedule requires at least one user player");
  }

  return {
    teamTrainingMenuId: "training.spike",
    individualAssignments: school.playerIds.map((playerId) => ({
      playerId,
      instructionId: "instruction.overall",
    })),
  };
}

export function createInitialWeeklySchedule(
  state: WeeklyScheduleSource,
): WeeklyScheduleState {
  const practicePlanning = buildInitialPracticePlanning(state);

  return {
    trainingPlan: createDefaultWeeklyPlan(state),
    practiceMatch: {
      ...practicePlanning,
      scheduledOpponentId: null,
      scheduledBy: null,
    },
    recentPracticeMatches: [],
    latestReport: null,
  };
}
