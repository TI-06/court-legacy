import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { GameState } from "../../../../src/domain/model/GameState";
import { playerId } from "../../../../src/domain/model/identifiers";
import type { ScoutReport } from "../../../../src/domain/scouting/scoutReport";
import { consumeBaseScoutingSearch } from "../../../../src/domain/scouting/scoutingSearchBudget";
import {
  buildRecruitmentCompetitionProfile,
  scoutingCycleKey,
} from "../../../../worker/scouting/serverScoutingBoard";

function contestedState(): GameState {
  const state = createDemoGame();
  return {
    ...state,
    recruiting: {
      cycleKey: scoutingCycleKey(state),
      committedCandidateIds: [],
      scoutingSearchWeekOfYear: state.calendar.weekOfYear,
    },
  };
}

const candidate = {
  candidateId: playerId("race-candidate"),
  evaluationStars: 5,
} as ScoutReport;

describe("Phase59 recruiting race", () => {
  it("records the discovery week for a new scouting search", () => {
    const state = createDemoGame();
    const searched = consumeBaseScoutingSearch(state);
    expect(searched?.recruiting?.scoutingSearchWeekOfYear).toBe(
      state.calendar.weekOfYear,
    );
  });

  it("shows the same deterministic deadline for the current search", () => {
    const state = contestedState();
    const first = buildRecruitmentCompetitionProfile(state, candidate);
    const second = buildRecruitmentCompetitionProfile(state, candidate);
    expect(first).toEqual(second);
    expect(first.competitorSchoolNames).toHaveLength(2);
    expect(first.competitorDecisionWeeksRemaining).toBeGreaterThanOrEqual(4);
    expect(first.competitorDecisionWeeksRemaining).toBeLessThanOrEqual(6);
    expect(first.signedByCompetitor).toBeNull();
  });

  it("lets the competitor sign an uncommitted candidate after the deadline", () => {
    const state = contestedState();
    const advanced = {
      ...state,
      calendar: {
        ...state.calendar,
        weekOfYear: state.calendar.weekOfYear + 9,
      },
    };
    const race = buildRecruitmentCompetitionProfile(advanced, candidate);
    expect(race.competitorDecisionWeeksRemaining).toBe(0);
    expect(race.signedByCompetitor).toBe(race.competitorSchoolNames[0]);
    expect(race.canCommit).toBe(false);
  });

  it("protects signed recruits and does not retroactively expire old saves", () => {
    const state = contestedState();
    const advanced = {
      ...state,
      recruiting: {
        ...state.recruiting!,
        committedCandidateIds: [candidate.candidateId],
      },
      calendar: {
        ...state.calendar,
        weekOfYear: state.calendar.weekOfYear + 9,
      },
    };
    expect(
      buildRecruitmentCompetitionProfile(advanced, candidate)
        .signedByCompetitor,
    ).toBeNull();

    const legacy = {
      ...advanced,
      recruiting: {
        ...advanced.recruiting,
        committedCandidateIds: [],
        scoutingSearchWeekOfYear: undefined,
      },
    };
    expect(
      buildRecruitmentCompetitionProfile(legacy, candidate)
        .competitorDecisionWeeksRemaining,
    ).toBeNull();
  });
});
