import type { GameState } from "../model/GameState";
import type { WeeklyPlan } from "../training/resolveWeeklyTraining";
import type { WeeklyScheduleState } from "./weeklyScheduleTypes";

type WeeklyScheduleSource = Pick<GameState, "userSchoolId" | "schools">;

export function createDefaultWeeklyPlan(
  state: WeeklyScheduleSource,
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
  return {
    trainingPlan: createDefaultWeeklyPlan(state),
    practiceMatch: {
      incomingOffer: null,
      outgoingCandidates: [],
      scheduledOpponentId: null,
      scheduledBy: null,
    },
    recentPracticeMatches: [],
    latestReport: null,
  };
}
