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

export function consumeBaseScoutingSearch(state: GameState): GameState | null {
  const remaining = scoutingBaseSearchesRemaining(state);
  if (remaining <= 0) return null;

  const cycleKey = `${state.userSchoolId}:year-${state.yearIndex}`;
  const current: RecruitingState =
    state.recruiting?.cycleKey === cycleKey
      ? state.recruiting
      : {
          cycleKey,
          committedCandidateIds: [],
          visitActionsUsed: 0,
          recommendationUsed: false,
          candidateEngagements: {},
        };

  return {
    ...state,
    recruiting: {
      ...current,
      scoutingSearchesUsed: scoutingSearchesUsed(state) + 1,
    },
  };
}
