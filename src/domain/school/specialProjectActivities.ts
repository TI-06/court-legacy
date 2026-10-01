import type { GameDataRegistry } from "../../data/dataRegistry";
import { calculateSelectionAverageAbility } from "../player/playerDevelopment";
import { SeededRandom } from "../random/SeededRandom";
import { autoSelectTeam } from "../team/autoSelectTeam";
import {
  resolvePlayerTrainingActivity,
  type PlayerGrowthLog,
  type TrainingActivity,
} from "../training/resolveWeeklyTraining";
import { addWeeks } from "../events/eventDate";
import type { GameState } from "../model/GameState";
import { eventId, type PlayerId, type SchoolId } from "../model/identifiers";
import type { Player } from "../model/Player";
import type { AbilityKey } from "../validation/gameDataSchema";
import type { UniversityJointTrainingFocus } from "./schoolSpecialProjects";

export type TopTeamClinicFocus =
  | "attack"
  | "defense"
  | "serve"
  | "setting"
  | "block"
  | "mental";

export interface UniversityJointTrainingResult {
  focus: UniversityJointTrainingFocus;
  participantCount: number;
  grewPlayerCount: number;
  totalAbilityGrowth: number;
  injuredPlayerIds: PlayerId[];
  averageFatigueChange: number;
  playerLogs: PlayerGrowthLog[];
}

const UNIVERSITY_FOCUS_ABILITIES: Record<
  UniversityJointTrainingFocus,
  readonly AbilityKey[]
> = {
  attack: ["spike", "serve", "set"],
  defense: ["receive", "block", "decision"],
  physical: ["jump", "speed", "stamina"],
};

const TOP_TEAM_CLINIC_EVENT_IDS: Record<TopTeamClinicFocus, string> = {
  attack: "event.phase51-clinic-attack",
  defense: "event.phase51-clinic-defense",
  serve: "event.phase51-clinic-serve",
  setting: "event.phase51-clinic-setting",
  block: "event.phase51-clinic-block",
  mental: "event.phase51-clinic-mental",
};

function clampState(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function schoolStrength(state: GameState, schoolId: SchoolId): number {
  try {
    const selection = autoSelectTeam({ state, schoolId });
    return calculateSelectionAverageAbility(state, selection);
  } catch {
    return 0;
  }
}

export function selectEliteExpeditionOpponent(
  state: GameState,
): SchoolId | null {
  const recent = new Set<SchoolId>([
    ...state.weeklySchedule.recentPracticeMatches
      .slice(-8)
      .map((entry) => entry.opponentSchoolId),
    ...state.history.matches.slice(-8).flatMap((match) => {
      if (match.homeSchoolId === state.userSchoolId) return [match.awaySchoolId];
      if (match.awaySchoolId === state.userSchoolId) return [match.homeSchoolId];
      return [];
    }),
  ]);

  const eligible = Object.values(state.schools)
    .filter(
      (school) =>
        school.id !== state.userSchoolId &&
        (school.reputation === "national-regular" ||
          school.reputation === "elite") &&
        school.playerIds.filter((playerId) => state.players[playerId]).length >=
          6,
    )
    .map((school) => ({
      schoolId: school.id,
      strength: schoolStrength(state, school.id),
      recent: recent.has(school.id),
    }))
    .filter((candidate) => candidate.strength > 0)
    .sort(
      (left, right) =>
        Number(left.recent) - Number(right.recent) ||
        right.strength - left.strength ||
        String(left.schoolId).localeCompare(String(right.schoolId)),
    );

  return eligible[0]?.schoolId ?? null;
}

export function scheduleEliteExpedition(
  state: GameState,
  opponentSchoolId: SchoolId,
): GameState {
  if (
    !state.schools[opponentSchoolId] ||
    opponentSchoolId === state.userSchoolId
  ) {
    return state;
  }

  return {
    ...state,
    weeklySchedule: {
      ...state.weeklySchedule,
      practiceMatch: {
        ...state.weeklySchedule.practiceMatch,
        incomingOffer: null,
        outgoingCandidates:
          state.weeklySchedule.practiceMatch.outgoingCandidates.map(
            (candidate) =>
              candidate.schoolId === opponentSchoolId
                ? { ...candidate, status: "accepted" as const }
                : candidate,
          ),
        scheduledOpponentId: opponentSchoolId,
        scheduledBy: "outgoing",
      },
    },
  };
}

export function scheduleUniversityJointTraining(
  state: GameState,
  focus: UniversityJointTrainingFocus,
): GameState {
  const current = state.schoolManagement.specialProjects;
  if (!current) return state;

  return {
    ...state,
    schoolManagement: {
      ...state.schoolManagement,
      specialProjects: {
        ...current,
        pendingUniversityJointTraining: {
          eligibleDate: addWeeks(state.date, 1),
          focus,
        },
      },
    },
  };
}
