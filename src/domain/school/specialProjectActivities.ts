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

function applyJointTrainingFatigue(player: Player, fatigue: number): Player {
  return {
    ...player,
    fatigue: clampState(player.fatigue + fatigue),
  };
}

export function resolveDueUniversityJointTraining(
  state: GameState,
  data: GameDataRegistry,
): { state: GameState; result: UniversityJointTrainingResult } | null {
  const projects = state.schoolManagement.specialProjects;
  const pending = projects?.pendingUniversityJointTraining;
  if (!projects || !pending || pending.eligibleDate > state.date) return null;

  const school = state.schools[state.userSchoolId];
  if (!school) return null;

  const random = new SeededRandom(state.seed, state.randomCursor);
  const players = { ...state.players };
  const logs: PlayerGrowthLog[] = [];
  const injuredPlayerIds: PlayerId[] = [];
  const activity: TrainingActivity = {
    targetAbilities: UNIVERSITY_FOCUS_ABILITIES[pending.focus],
    baseGrowth: 3,
    fatigue: 0,
    injuryRisk: 4,
    trustGrowth: 1,
  };

  for (const playerId of school.playerIds) {
    const original = players[playerId];
    if (!original) continue;

    const resolved = resolvePlayerTrainingActivity({
      player: original,
      school,
      data,
      random,
      activity,
    });
    const fatigueChange = original.injury ? 0 : 8;
    const player = original.injury
      ? resolved.player
      : applyJointTrainingFatigue(resolved.player, fatigueChange);
    const log: PlayerGrowthLog = {
      ...resolved.log,
      fatigueChange: resolved.log.fatigueChange + fatigueChange,
    };

    players[playerId] = player;
    logs.push(log);
    if (log.injury) injuredPlayerIds.push(playerId);
  }

  const nextProjects = { ...projects };
  delete nextProjects.pendingUniversityJointTraining;
  const totalFatigueChange = logs.reduce(
    (total, log) => total + log.fatigueChange,
    0,
  );

  return {
    state: {
      ...state,
      randomCursor: random.cursor,
      players,
      schoolManagement: {
        ...state.schoolManagement,
        specialProjects: nextProjects,
      },
    },
    result: {
      focus: pending.focus,
      participantCount: logs.length,
      grewPlayerCount: logs.filter((log) => log.totalAbilityGrowth > 0).length,
      totalAbilityGrowth: logs.reduce(
        (total, log) => total + log.totalAbilityGrowth,
        0,
      ),
      injuredPlayerIds,
      averageFatigueChange:
        logs.length === 0 ? 0 : totalFatigueChange / logs.length,
      playerLogs: logs,
    },
  };
}

export function scheduleTopTeamClinic(
  state: GameState,
  targetPlayerId: PlayerId,
  focus: TopTeamClinicFocus,
): GameState {
  const school = state.schools[state.userSchoolId];
  const player = state.players[targetPlayerId];
  if (!school?.playerIds.includes(targetPlayerId) || !player || player.injury) {
    return state;
  }

  return {
    ...state,
    eventMemory: {
      ...state.eventMemory,
      scheduledFollowUps: [
        ...state.eventMemory.scheduledFollowUps,
        {
          eventId: eventId(TOP_TEAM_CLINIC_EVENT_IDS[focus]),
          eligibleDate: addWeeks(state.date, 1),
          actorPlayerIds: [targetPlayerId],
          chainId: `phase51-top-team-clinic:${state.yearIndex}:${targetPlayerId}`,
          chainStage: 1,
        },
      ],
    },
  };
}
