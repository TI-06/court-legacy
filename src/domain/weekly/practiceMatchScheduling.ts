import type { GameState } from "../model/GameState";
import type { SchoolId } from "../model/identifiers";
import { SeededRandom } from "../random/SeededRandom";
import { hasRequiredOfficialMatch } from "../tournament/progressOfficialTournaments";

export type PracticeSchedulingErrorCode =
  | "official_match_required"
  | "practice_match_already_scheduled"
  | "practice_offer_not_available"
  | "practice_candidate_not_available";

export class PracticeSchedulingError extends Error {
  constructor(
    public readonly code: PracticeSchedulingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PracticeSchedulingError";
  }
}

export type PracticeSchedulingOutcome =
  | {
      type: "practice-offer-accepted";
      schoolId: SchoolId;
    }
  | {
      type: "practice-offer-declined";
      schoolId: SchoolId;
    }
  | {
      type: "practice-request-result";
      schoolId: SchoolId;
      accepted: boolean;
      acceptancePercent: number;
      roll: number;
    };

export interface PracticeSchedulingResult {
  state: GameState;
  outcome: PracticeSchedulingOutcome;
}

function schedulingConflict(
  code: PracticeSchedulingErrorCode,
  message: string,
): never {
  throw new PracticeSchedulingError(code, message);
}

function assertSchedulingAvailable(state: GameState): void {
  if (hasRequiredOfficialMatch(state)) {
    schedulingConflict(
      "official_match_required",
      "公式戦がある週は練習試合を設定できません",
    );
  }
  if (state.weeklySchedule.practiceMatch.scheduledOpponentId) {
    schedulingConflict(
      "practice_match_already_scheduled",
      "今週の練習試合はすでに決まっています",
    );
  }
}

export function acceptIncomingPracticeOffer(
  state: GameState,
): PracticeSchedulingResult {
  assertSchedulingAvailable(state);
  const offer = state.weeklySchedule.practiceMatch.incomingOffer;
  if (!offer) {
    return schedulingConflict(
      "practice_offer_not_available",
      "受けられる練習試合の申し込みがありません",
    );
  }

  return {
    state: {
      ...state,
      weeklySchedule: {
        ...state.weeklySchedule,
        practiceMatch: {
          ...state.weeklySchedule.practiceMatch,
          incomingOffer: null,
          scheduledOpponentId: offer.schoolId,
          scheduledBy: "incoming",
        },
      },
    },
    outcome: {
      type: "practice-offer-accepted",
      schoolId: offer.schoolId,
    },
  };
}

export function declineIncomingPracticeOffer(
  state: GameState,
): PracticeSchedulingResult {
  assertSchedulingAvailable(state);
  const offer = state.weeklySchedule.practiceMatch.incomingOffer;
  if (!offer) {
    return schedulingConflict(
      "practice_offer_not_available",
      "断る練習試合の申し込みがありません",
    );
  }

  return {
    state: {
      ...state,
      weeklySchedule: {
        ...state.weeklySchedule,
        practiceMatch: {
          ...state.weeklySchedule.practiceMatch,
          incomingOffer: null,
        },
      },
    },
    outcome: {
      type: "practice-offer-declined",
      schoolId: offer.schoolId,
    },
  };
}

export function requestPracticeMatch(
  state: GameState,
  schoolId: SchoolId,
): PracticeSchedulingResult {
  assertSchedulingAvailable(state);
  const candidate = state.weeklySchedule.practiceMatch.outgoingCandidates.find(
    (entry) => entry.schoolId === schoolId,
  );
  if (!candidate || candidate.status !== "available") {
    return schedulingConflict(
      "practice_candidate_not_available",
      "この学校には現在練習試合を申し込めません",
    );
  }

  const random = new SeededRandom(state.seed).fork(
    `practice-request:${state.date}:${state.userSchoolId}:${schoolId}`,
  );
  const roll = random.int(1, 100);
  const accepted = roll <= candidate.acceptancePercent;
  const outgoingCandidates =
    state.weeklySchedule.practiceMatch.outgoingCandidates.map((entry) =>
      entry.schoolId === schoolId
        ? {
            ...entry,
            status: accepted ? ("accepted" as const) : ("rejected" as const),
          }
        : entry,
    );

  return {
    state: {
      ...state,
      weeklySchedule: {
        ...state.weeklySchedule,
        practiceMatch: {
          ...state.weeklySchedule.practiceMatch,
          incomingOffer: accepted
            ? null
            : state.weeklySchedule.practiceMatch.incomingOffer,
          outgoingCandidates,
          scheduledOpponentId: accepted ? schoolId : null,
          scheduledBy: accepted ? "outgoing" : null,
        },
      },
    },
    outcome: {
      type: "practice-request-result",
      schoolId,
      accepted,
      acceptancePercent: candidate.acceptancePercent,
      roll,
    },
  };
}
