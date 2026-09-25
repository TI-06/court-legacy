import { describe, expect, it } from "vitest";
import type { GameState } from "../../../../src/domain/model/GameState";
import {
  ANNUAL_BASE_SCOUT_SEARCHES,
  addExtraScoutingSearchCredit,
  consumeBaseScoutingSearch,
  consumeExtraScoutingSearchCredit,
  scoutingBaseSearchesRemaining,
  scoutingSearchesUsed,
} from "../../../../src/domain/scouting/scoutingSearchBudget";

function stateWithRecruiting(
  recruiting?: GameState["recruiting"],
): GameState {
  return {
    userSchoolId: "school-user",
    yearIndex: 4,
    recruiting,
  } as GameState;
}

describe("scouting annual search budget", () => {
  it("starts each academic year with three base searches", () => {
    const state = stateWithRecruiting();

    expect(ANNUAL_BASE_SCOUT_SEARCHES).toBe(3);
    expect(scoutingSearchesUsed(state)).toBe(0);
    expect(scoutingBaseSearchesRemaining(state)).toBe(3);
  });

  it("consumes base searches until the third search and then stops", () => {
    let state = stateWithRecruiting();

    for (let used = 1; used <= 3; used += 1) {
      const next = consumeBaseScoutingSearch(state);
      expect(next).not.toBeNull();
      state = next!;
      expect(scoutingSearchesUsed(state)).toBe(used);
      expect(scoutingBaseSearchesRemaining(state)).toBe(3 - used);
    }

    expect(consumeBaseScoutingSearch(state)).toBeNull();
  });

  it("resets automatically when the academic-year cycle changes", () => {
    const state = stateWithRecruiting({
      cycleKey: "school-user:year-3",
      committedCandidateIds: ["candidate-a"],
      scoutingSearchesUsed: 3,
    });

    expect(scoutingSearchesUsed(state)).toBe(0);
    expect(scoutingBaseSearchesRemaining(state)).toBe(3);
  });

  it("does not retain prior-cycle recruiting payload when a new search begins", () => {
    const state = stateWithRecruiting({
      cycleKey: "school-user:year-3",
      committedCandidateIds: ["candidate-a"],
      visitActionsUsed: 4,
      recommendationUsed: true,
      scoutingSearchesUsed: 3,
    });

    const next = consumeBaseScoutingSearch(state);

    expect(next?.recruiting).toMatchObject({
      cycleKey: "school-user:year-4",
      committedCandidateIds: [],
      visitActionsUsed: 0,
      recommendationUsed: false,
      scoutingSearchesUsed: 1,
    });
  });
  it("stores extra search credit until a later search consumes it", () => {
    let state = stateWithRecruiting({
      cycleKey: "school-user:year-4",
      committedCandidateIds: [],
      scoutingSearchesUsed: 3,
    });

    state = addExtraScoutingSearchCredit(state);
    expect(state.recruiting?.extraScoutingSearchCredits).toBe(1);

    const searched = consumeExtraScoutingSearchCredit(state);
    expect(searched?.recruiting).toMatchObject({
      scoutingSearchesUsed: 4,
      extraScoutingSearchCredits: 0,
    });
  });

  it("does not allow an extra search without a persisted credit", () => {
    const state = stateWithRecruiting({
      cycleKey: "school-user:year-4",
      committedCandidateIds: [],
      scoutingSearchesUsed: 3,
    });

    expect(consumeExtraScoutingSearchCredit(state)).toBeNull();
  });

  it("keeps multiple purchased credits and consumes exactly one per search", () => {
    let state = stateWithRecruiting({
      cycleKey: "school-user:year-4",
      committedCandidateIds: [],
      scoutingSearchesUsed: 3,
    });

    state = addExtraScoutingSearchCredit(state);
    state = addExtraScoutingSearchCredit(state);
    const fourth = consumeExtraScoutingSearchCredit(state);
    const fifth = fourth ? consumeExtraScoutingSearchCredit(fourth) : null;

    expect(fourth?.recruiting).toMatchObject({
      scoutingSearchesUsed: 4,
      extraScoutingSearchCredits: 1,
    });
    expect(fifth?.recruiting).toMatchObject({
      scoutingSearchesUsed: 5,
      extraScoutingSearchCredits: 0,
    });
  });

  it("does not carry an old academic year's extra credit into the new cycle", () => {
    const state = stateWithRecruiting({
      cycleKey: "school-user:year-3",
      committedCandidateIds: [],
      scoutingSearchesUsed: 3,
      extraScoutingSearchCredits: 2,
    });

    expect(consumeExtraScoutingSearchCredit(state)).toBeNull();
    expect(scoutingBaseSearchesRemaining(state)).toBe(3);
  });
});
