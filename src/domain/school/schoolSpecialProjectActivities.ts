import type { GameDataRegistry } from "../../data/dataRegistry";
import { addWeeks } from "../events/eventDate";
import type { GameState } from "../model/GameState";
import { eventId, type PlayerId, type SchoolId } from "../model/identifiers";
import { SeededRandom } from "../random/SeededRandom";
import { hasRequiredOfficialMatch } from "../tournament/progressOfficialTournaments";
import {
  resolvePlayerTrainingActivity,
  type TrainingActivity,
} from "../training/resolveWeeklyTraining";
import type { UniversityJointTrainingFocus } from "./schoolSpecialProjects";

export type TopTeamClinicFocus = "attack" | "defense" | "mental";

export class SchoolSpecialProjectActivityError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SchoolSpecialProjectActivityError";
  }
}

function activityConflict(code: string, message: string): never {
  throw new SchoolSpecialProjectActivityError(code, message);
}

function recentPracticeOpponentIds(state: GameState): ReadonlySet<SchoolId> {
  return new Set(
    state.weeklySchedule.recentPracticeMatches
      .slice(-5)
      .map((match) => match.opponentSchoolId),
  );
}

export function selectEliteExpeditionOpponent(
  state: GameState,
): SchoolId | null {
  const recent = recentPracticeOpponentIds(state);
  const candidates = Object.values(state.schools)
    .filter(
      (school) =>
        school.id !== state.userSchoolId &&
        (school.reputation === "national-regular" ||
          school.reputation === "elite"),
    )
    .sort(
      (left, right) =>
        right.reputationPoints - left.reputationPoints ||
        left.id.localeCompare(right.id),
    );
  return (
    candidates.find((school) => !recent.has(school.id))?.id ??
    candidates[0]?.id ??
    null
  );
}

export function scheduleEliteExpedition(state: GameState): {
  state: GameState;
  opponentSchoolId: SchoolId;
} {
  if (hasRequiredOfficialMatch(state)) {
    return activityConflict(
      "elite_expedition_official_match_required",
      "公式戦がある週は全国強豪遠征を設定できません",
    );
  }
  if (state.weeklySchedule.practiceMatch.scheduledOpponentId) {
    return activityConflict(
      "elite_expedition_practice_already_scheduled",
      "今週はすでに練習試合が決まっています",
    );
  }
  const opponentSchoolId = selectEliteExpeditionOpponent(state);
  if (!opponentSchoolId) {
    return activityConflict(
      "elite_expedition_opponent_not_found",
      "遠征できる全国強豪校が見つかりません",
    );
  }

  return {
    opponentSchoolId,
    state: {
      ...state,
      weeklySchedule: {
        ...state.weeklySchedule,
        practiceMatch: {
          ...state.weeklySchedule.practiceMatch,
          incomingOffer: null,
          scheduledOpponentId: opponentSchoolId,
          scheduledBy: "outgoing",
        },
      },
    },
  };
}

export function scheduleUniversityJointTraining(
  state: GameState,
  focus: UniversityJointTrainingFocus,
): GameState {
  if (!["attack", "defense", "physical"].includes(focus)) {
    return activityConflict(
      "university_joint_training_invalid_focus",
      "合同練習のテーマを選択してください",
    );
  }
  const current = state.schoolManagement.specialProjects;
  if (current?.pendingActivity) {
    return activityConflict(
      "special_project_activity_already_pending",
      "実施待ちの特別活動があります",
    );
  }
  if (!current || current.yearIndex !== state.yearIndex) {
    return activityConflict(
      "special_project_state_missing",
      "特別事業の年度状態を確認できません",
    );
  }

  return {
    ...state,
    schoolManagement: {
      ...state.schoolManagement,
      specialProjects: {
        ...current,
        pendingActivity: {
          kind: "university-joint-training",
          scheduledDate: addWeeks(state.date, 1),
          focus,
        },
      },
    },
  };
}

const jointTrainingActivities: Record<
  UniversityJointTrainingFocus,
  TrainingActivity
> = {
  attack: {
    targetAbilities: ["spike", "serve", "set"],
    baseGrowth: 4,
    fatigue: 8,
    injuryRisk: 3,
    trustGrowth: 1,
  },
  defense: {
    targetAbilities: ["receive", "block", "decision"],
    baseGrowth: 4,
    fatigue: 8,
    injuryRisk: 3,
    trustGrowth: 1,
  },
  physical: {
    targetAbilities: ["jump", "speed", "stamina"],
    baseGrowth: 4,
    fatigue: 10,
    injuryRisk: 5,
    trustGrowth: 1,
  },
};

function clampState(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export interface UniversityJointTrainingResult {
  focus: UniversityJointTrainingFocus;
  participantCount: number;
  totalAbilityGrowth: number;
  injuredPlayerIds: PlayerId[];
}

export function resolveDueUniversityJointTraining(
  state: GameState,
  data: GameDataRegistry,
): { state: GameState; result: UniversityJointTrainingResult } | null {
  const projects = state.schoolManagement.specialProjects;
  const pending = projects?.pendingActivity;
  if (
    !projects ||
    !pending ||
    pending.kind !== "university-joint-training" ||
    pending.scheduledDate > state.date
  ) {
    return null;
  }

  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error("user school is missing");
  }
  const random = new SeededRandom(state.seed, state.randomCursor);
  const players = { ...state.players };
  let participantCount = 0;
  let totalAbilityGrowth = 0;
  const injuredPlayerIds: PlayerId[] = [];

  for (const playerId of school.playerIds) {
    const player = players[playerId];
    if (!player || player.injury) continue;
    const resolved = resolvePlayerTrainingActivity({
      player,
      school,
      data,
      random,
      activity: jointTrainingActivities[pending.focus],
      additionalGrowthModifiers: [
        {
          code: "school-development-investment",
          label: "大学合同練習",
          percent: 108,
        },
      ],
    });
    const nextPlayer = {
      ...resolved.player,
      fatigue: clampState(
        resolved.player.fatigue +
          jointTrainingActivities[pending.focus].fatigue,
      ),
    };
    players[playerId] = nextPlayer;
    participantCount += 1;
    totalAbilityGrowth += resolved.log.totalAbilityGrowth;
    if (!player.injury && nextPlayer.injury) {
      injuredPlayerIds.push(playerId);
    }
  }

  const remainingProjects = { ...projects };
  delete remainingProjects.pendingActivity;
  return {
    state: {
      ...state,
      players,
      randomCursor: random.cursor,
      schoolManagement: {
        ...state.schoolManagement,
        specialProjects: remainingProjects,
      },
    },
    result: {
      focus: pending.focus,
      participantCount,
      totalAbilityGrowth,
      injuredPlayerIds,
    },
  };
}

const clinicEventByFocus: Record<TopTeamClinicFocus, string> = {
  attack: "event.phase51-top-team-clinic-attack",
  defense: "event.phase51-top-team-clinic-defense",
  mental: "event.phase51-top-team-clinic-mental",
};

export function scheduleTopTeamClinic(
  state: GameState,
  targetPlayerId: PlayerId,
  focus: TopTeamClinicFocus,
): GameState {
  const school = state.schools[state.userSchoolId];
  const player = state.players[targetPlayerId];
  if (!school?.playerIds.includes(targetPlayerId) || !player) {
    return activityConflict(
      "top_team_clinic_invalid_player",
      "講習を受ける選手を確認できません",
    );
  }
  if (!["attack", "defense", "mental"].includes(focus)) {
    return activityConflict(
      "top_team_clinic_invalid_focus",
      "トップチーム講習のテーマを選択してください",
    );
  }

  return {
    ...state,
    eventMemory: {
      ...state.eventMemory,
      scheduledFollowUps: [
        ...state.eventMemory.scheduledFollowUps,
        {
          eventId: eventId(clinicEventByFocus[focus]),
          eligibleDate: addWeeks(state.date, 1),
          actorPlayerIds: [targetPlayerId],
          chainId: `phase51-top-team-clinic:${state.yearIndex}:${targetPlayerId}`,
          chainStage: 1,
        },
      ],
    },
  };
}
