import type { GameState, RecruitingState } from "../model/GameState";

export const ANNUAL_BASE_SCOUT_SEARCHES = 3;

export function scoutingSearchesUsed(state: GameState): number {
  const cycleKey = `${state.userSchoolId}:year-${state.yearIndex}`;
  if (state.recruiting?.cycleKey !== cycleKey) return 0;
  return Math.max(0, state.recruiting.scoutingSearchesUsed ?? 0);
}

export function scoutingBaseSearchesRemaining(state: GameState): number {
  return Math.max(0, ANNUAL_BASE_SCOUT_SEARCHES - scoutingSearchesUsed(state));
}

function currentRecruitingState(state: GameState): RecruitingState {
  const cycleKey = `${state.userSchoolId}:year-${state.yearIndex}`;
  return state.recruiting?.cycleKey === cycleKey
    ? state.recruiting
    : {
        cycleKey,
        committedCandidateIds: [],
        visitActionsUsed: 0,
        recommendationUsed: false,
        candidateEngagements: {},
      };
}

export interface ScoutingSearchItemBonuses {
  extraCandidateCount: number;
  guaranteedGenerationalCount: number;
}

export function scoutingSearchItemBonuses(
  state: GameState,
): ScoutingSearchItemBonuses {
  const cycleKey = `${state.userSchoolId}:year-${state.yearIndex}`;
  if (state.recruiting?.cycleKey !== cycleKey) {
    return { extraCandidateCount: 0, guaranteedGenerationalCount: 0 };
  }
  return {
    extraCandidateCount: Math.max(
      0,
      state.recruiting.pendingExtraScoutCandidates ?? 0,
    ),
    guaranteedGenerationalCount: Math.max(
      0,
      state.recruiting.pendingGenerationalScoutCandidates ?? 0,
    ),
  };
}

export function addPendingExtraScoutCandidate(state: GameState): GameState {
  const current = currentRecruitingState(state);
  return {
    ...state,
    recruiting: {
      ...current,
      pendingExtraScoutCandidates:
        Math.max(0, current.pendingExtraScoutCandidates ?? 0) + 1,
    },
  };
}

export function addPendingGenerationalScoutCandidate(
  state: GameState,
): GameState {
  const current = currentRecruitingState(state);
  return {
    ...state,
    recruiting: {
      ...current,
      pendingGenerationalScoutCandidates:
        Math.max(0, current.pendingGenerationalScoutCandidates ?? 0) + 1,
    },
  };
}

export function consumeScoutingSearchItemBonuses(state: GameState): GameState {
  const bonuses = scoutingSearchItemBonuses(state);
  if (
    bonuses.extraCandidateCount === 0 &&
    bonuses.guaranteedGenerationalCount === 0
  ) {
    return state;
  }

  const current = currentRecruitingState(state);
  return {
    ...state,
    recruiting: {
      ...current,
      pendingExtraScoutCandidates: 0,
      pendingGenerationalScoutCandidates: 0,
    },
  };
}

export function addExtraScoutingSearchCredit(state: GameState): GameState {
  const current = currentRecruitingState(state);
  return {
    ...state,
    recruiting: {
      ...current,
      extraScoutingSearchCredits:
        Math.max(0, current.extraScoutingSearchCredits ?? 0) + 1,
    },
  };
}

export function consumeExtraScoutingSearchCredit(
  state: GameState,
): GameState | null {
  const current = currentRecruitingState(state);
  const credits = Math.max(0, current.extraScoutingSearchCredits ?? 0);
  if (credits <= 0) return null;

  return {
    ...state,
    recruiting: {
      ...current,
      scoutingSearchesUsed: scoutingSearchesUsed(state) + 1,
      extraScoutingSearchCredits: credits - 1,
    },
  };
}

export function consumeBaseScoutingSearch(state: GameState): GameState | null {
  const remaining = scoutingBaseSearchesRemaining(state);
  if (remaining <= 0) return null;

  const current = currentRecruitingState(state);

  return {
    ...state,
    recruiting: {
      ...current,
      scoutingSearchesUsed: scoutingSearchesUsed(state) + 1,
    },
  };
}
