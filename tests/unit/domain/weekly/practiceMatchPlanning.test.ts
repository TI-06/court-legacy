import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { calculateTournamentSchoolStrength } from "../../../../src/domain/tournament/createOfficialSeason";
import {
  advanceOfficialTournamentsThroughWeek,
  findDueUserOfficialMatch,
} from "../../../../src/domain/tournament/progressOfficialTournaments";
import { createInitialWeeklySchedule } from "../../../../src/domain/weekly/createWeeklySchedule";
import * as practicePlanning from "../../../../src/domain/weekly/practiceMatchPlanning";

const planningApi = practicePlanning as unknown as {
  PRACTICE_INCOMING_CHANCE: Record<string, number>;
  PRACTICE_INCOMING_TARGET_RATIO: Record<string, number>;
  practiceRating: (ratio: number) => 1 | 2 | 3 | 4 | 5;
  practiceAcceptancePercent: (
    homeReputationPoints: number,
    opponentReputationPoints: number,
    homeStrength: number,
    opponentStrength: number,
    recentMeetingCount: number,
  ) => number;
};

describe("Phase 8 practice-match planning", () => {
  it("creates three unique deterministic outgoing candidates without consuming randomCursor", () => {
    const state = createDemoGame();
    const beforeCursor = state.randomCursor;

    const first = createInitialWeeklySchedule(state);
    const second = createInitialWeeklySchedule(state);

    expect(first.practiceMatch).toEqual(second.practiceMatch);
    expect(state.randomCursor).toBe(beforeCursor);
    expect(first.practiceMatch.outgoingCandidates).toHaveLength(3);
    expect(
      new Set(
        first.practiceMatch.outgoingCandidates.map(
          (candidate) => candidate.schoolId,
        ),
      ).size,
    ).toBe(3);
    expect(
      first.practiceMatch.outgoingCandidates.every(
        (candidate) => candidate.schoolId !== state.userSchoolId,
      ),
    ).toBe(true);
  });

  it("uses the exact incoming-offer chances and target-strength ratios", () => {
    expect(planningApi.PRACTICE_INCOMING_CHANCE).toEqual({
      unknown: 20,
      "district-contender": 30,
      "prefectural-power": 45,
      "national-qualifier": 52,
      "national-regular": 58,
      elite: 65,
    });
    expect(planningApi.PRACTICE_INCOMING_TARGET_RATIO).toEqual({
      unknown: 0.9,
      "district-contender": 0.95,
      "prefectural-power": 1,
      "national-qualifier": 1.05,
      "national-regular": 1.1,
      elite: 1.15,
    });
  });

  it("maps opponent strength ratios to the exact five display ratings", () => {
    expect(planningApi.practiceRating(0.85)).toBe(1);
    expect(planningApi.practiceRating(0.8501)).toBe(2);
    expect(planningApi.practiceRating(0.95)).toBe(2);
    expect(planningApi.practiceRating(0.9501)).toBe(3);
    expect(planningApi.practiceRating(1.05)).toBe(3);
    expect(planningApi.practiceRating(1.0501)).toBe(4);
    expect(planningApi.practiceRating(1.15)).toBe(4);
    expect(planningApi.practiceRating(1.1501)).toBe(5);
  });

  it("uses the exact acceptance formula including repeat-opponent decay and clamping", () => {
    expect(planningApi.practiceAcceptancePercent(500, 450, 60, 65, 0)).toBe(65);
    expect(planningApi.practiceAcceptancePercent(500, 450, 60, 65, 2)).toBe(35);
    expect(planningApi.practiceAcceptancePercent(1000, 0, 100, 1, 0)).toBe(95);
    expect(planningApi.practiceAcceptancePercent(0, 1000, 1, 100, 12)).toBe(5);
  });

  it("labels the three outgoing choices as same, stronger, and challenge with matching ratings", () => {
    const state = createDemoGame();
    const home = state.schools[state.userSchoolId]!;
    const homeStrength = calculateTournamentSchoolStrength(state, home);
    const schedule = createInitialWeeklySchedule(state);

    expect(
      schedule.practiceMatch.outgoingCandidates.map(
        (candidate) => candidate.tier,
      ),
    ).toEqual(["same", "stronger", "challenge"]);
    for (const candidate of schedule.practiceMatch.outgoingCandidates) {
      const opponent = state.schools[candidate.schoolId]!;
      const ratio =
        calculateTournamentSchoolStrength(state, opponent) /
        Math.max(1, homeStrength);
      expect(candidate.growthRating).toBe(planningApi.practiceRating(ratio));
    }
  });

  it("suppresses every practice-match planning option when an official match is due", () => {
    let state = createDemoGame();
    state = {
      ...state,
      calendar: {
        ...state.calendar,
        weekOfYear: 9,
      },
    };
    state = advanceOfficialTournamentsThroughWeek(state);

    expect(findDueUserOfficialMatch(state)).not.toBeNull();
    const planning = practicePlanning.buildPracticePlanning(state);
    expect(planning.incomingOffer).toBeNull();
    expect(planning.outgoingCandidates).toEqual([]);
  });
});
