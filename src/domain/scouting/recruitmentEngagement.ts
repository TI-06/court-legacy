import type {
  GameState,
  RecruitingCandidateEngagement,
  RecruitingState,
} from "../model/GameState";
import type { PlayerId } from "../model/identifiers";

export type RecruitmentAction = "visit" | "recommendation" | "commit";
export type RecruitmentInterestLevel = "low" | "medium" | "high" | "ready";

export const RECRUITMENT_COMMIT_THRESHOLD = 60;
export const RECRUITMENT_VISIT_LIMIT = 4;
export const RECRUITMENT_RECOMMENDATION_LIMIT = 1;
export const RECRUITMENT_VISIT_BONUS = 12;
export const RECRUITMENT_RECOMMENDATION_BONUS = 24;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function recruitingCycleKeyForState(state: GameState): string {
  return `${state.userSchoolId}:year-${state.yearIndex}`;
}

export function activeRecruitingState(state: GameState): RecruitingState {
  const cycleKey = recruitingCycleKeyForState(state);
  if (state.recruiting?.cycleKey === cycleKey) {
    return state.recruiting;
  }
  return {
    cycleKey,
    committedCandidateIds: [],
    visitActionsUsed: 0,
    recommendationUsed: false,
    candidateEngagements: {},
  };
}

export function recruitmentVisitsRemaining(state: GameState): number {
  const recruiting = activeRecruitingState(state);
  return Math.max(
    0,
    RECRUITMENT_VISIT_LIMIT - (recruiting.visitActionsUsed ?? 0),
  );
}

export function recruitmentRecommendationAvailable(state: GameState): boolean {
  const recruiting = activeRecruitingState(state);
  return !(recruiting.recommendationUsed ?? false);
}

export function recruitmentBaseInterest(
  state: GameState,
  evaluationStars: 1 | 2 | 3 | 4 | 5,
): number {
  const school = state.schools[state.userSchoolId];
  if (!school) return 0;

  const reputationBonus = clamp(school.reputationPoints, 0, 1400) / 70;
  const charismaBonus = clamp(school.coach.charisma, 0, 100) * 0.2;
  const facilityBonus =
    clamp(school.facilities.scoutingNetwork, 0, 50) * 0.4 +
    clamp(school.facilities.dormitory, 0, 50) * 0.2;
  const demandPenalty = (evaluationStars - 1) * 12;

  return clamp(
    Math.round(70 + reputationBonus + charismaBonus + facilityBonus - demandPenalty),
    25,
    95,
  );
}

export function candidateEngagement(
  state: GameState,
  candidateId: PlayerId,
): RecruitingCandidateEngagement {
  const recruiting = activeRecruitingState(state);
  return (
    recruiting.candidateEngagements?.[candidateId] ?? {
      interestBonus: 0,
      visits: 0,
      recommendationUsed: false,
    }
  );
}

export function recruitmentInterestScore(
  state: GameState,
  candidateId: PlayerId,
  evaluationStars: 1 | 2 | 3 | 4 | 5,
): number {
  return clamp(
    recruitmentBaseInterest(state, evaluationStars) +
      candidateEngagement(state, candidateId).interestBonus,
    0,
    100,
  );
}

export function recruitmentInterestLevel(
  score: number,
): RecruitmentInterestLevel {
  if (score >= RECRUITMENT_COMMIT_THRESHOLD) return "ready";
  if (score >= 50) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export interface RecruitmentActionResult {
  state: GameState;
  applied: boolean;
  reason:
    | "applied"
    | "already-committed"
    | "visit-limit"
    | "recommendation-limit";
}

export function applyRecruitmentAction(
  state: GameState,
  candidateId: PlayerId,
  action: Exclude<RecruitmentAction, "commit">,
): RecruitmentActionResult {
  const recruiting = activeRecruitingState(state);
  if (recruiting.committedCandidateIds.includes(candidateId)) {
    return { state, applied: false, reason: "already-committed" };
  }

  const engagement = candidateEngagement(state, candidateId);

  if (action === "visit") {
    const used = recruiting.visitActionsUsed ?? 0;
    if (used >= RECRUITMENT_VISIT_LIMIT) {
      return { state, applied: false, reason: "visit-limit" };
    }
    const nextRecruiting: RecruitingState = {
      ...recruiting,
      visitActionsUsed: used + 1,
      candidateEngagements: {
        ...(recruiting.candidateEngagements ?? {}),
        [candidateId]: {
          ...engagement,
          visits: engagement.visits + 1,
          interestBonus: engagement.interestBonus + RECRUITMENT_VISIT_BONUS,
        },
      },
    };
    return {
      state: { ...state, recruiting: nextRecruiting },
      applied: true,
      reason: "applied",
    };
  }

  if (recruiting.recommendationUsed || engagement.recommendationUsed) {
    return { state, applied: false, reason: "recommendation-limit" };
  }
  const nextRecruiting: RecruitingState = {
    ...recruiting,
    recommendationUsed: true,
    candidateEngagements: {
      ...(recruiting.candidateEngagements ?? {}),
      [candidateId]: {
        ...engagement,
        recommendationUsed: true,
        interestBonus:
          engagement.interestBonus + RECRUITMENT_RECOMMENDATION_BONUS,
      },
    },
  };
  return {
    state: { ...state, recruiting: nextRecruiting },
    applied: true,
    reason: "applied",
  };
}
