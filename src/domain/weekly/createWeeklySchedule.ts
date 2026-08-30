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
  const firstPlayerId = school.playerIds[0];
  const secondPlayerId = school.playerIds[1];
  if (!firstPlayerId || !secondPlayerId) {
    throw new Error("weekly schedule requires at least two user players");
  }

  return {
    teamTrainingMenuId: "training.spike",
    individualAssignments: [
      {
        playerId: firstPlayerId,
        instructionId: "instruction.serve",
      },
      {
        playerId: secondPlayerId,
        instructionId: "instruction.receive",
      },
    ],
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
