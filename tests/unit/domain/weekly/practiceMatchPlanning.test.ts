import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { markWeeklyActionCompleted } from "../../../../src/domain/calendar/weekProgression";
import {
  matchId,
  type GameDate,
} from "../../../../src/domain/model/identifiers";
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

  it("rotates incoming offers among similarly suitable schools over time", () => {
    const base = createDemoGame();
    const home = base.schools[base.userSchoolId]!;
    base.schools[base.userSchoolId] = {
      ...home,
      reputation: "elite",
    };
    const offeredSchoolIds = new Set<string>();

    for (let day = 1; day <= 28; day += 1) {
      const state = {
        ...base,
        date: `2026-04-${String(day).padStart(2, "0")}` as GameDate,
      };
      const offer =
        practicePlanning.buildInitialPracticePlanning(state).incomingOffer;
      if (offer) offeredSchoolIds.add(offer.schoolId);
    }

    expect(offeredSchoolIds.size).toBeGreaterThan(1);
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

  it.each([
    ["same", true, "stronger"],
    ["same", false, "same"],
    ["stronger", true, "challenge"],
    ["stronger", false, "stronger"],
    ["challenge", true, "challenge"],
    ["challenge", false, "stronger"],
  ] as const)(
    "moves the next practice tier from %s and win=%s to %s",
    (tier, won, expectedTier) => {
      expect(practicePlanning.nextPracticeTierFromResult(tier, won)).toBe(
        expectedTier,
      );
    },
  );

  it("keeps the featured rival in the weekly candidates and recommends the rematch first", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    state.weeklySchedule.practiceMatch.scheduledOpponentId = null;
    const rival = Object.values(state.schools).find(
      (school) =>
        school.id !== state.userSchoolId &&
        !state.weeklySchedule.practiceMatch.outgoingCandidates.some(
          (candidate) => candidate.schoolId === school.id,
        ),
    );
    expect(rival).toBeDefined();

    state.world.destinyRivalSchoolId = rival!.id;
    state.history.matches.push({
      matchId: matchId("phase31-rival-rematch"),
      date: "2026-03-20" as GameDate,
      homeSchoolId: state.userSchoolId,
      awaySchoolId: rival!.id,
      winnerSchoolId: rival!.id,
      homeSetsWon: 1,
      awaySetsWon: 2,
      tournamentId: null,
    });

    let planning: ReturnType<
      typeof practicePlanning.buildPracticePlanning
    > | null = null;
    for (let day = 1; day <= 28; day += 1) {
      const candidateState = {
        ...state,
        date: `2026-04-${String(day).padStart(2, "0")}` as GameDate,
      };
      const candidatePlanning =
        practicePlanning.buildPracticePlanning(candidateState);
      if (!candidatePlanning.incomingOffer) {
        state.date = candidateState.date;
        planning = candidatePlanning;
        break;
      }
    }

    expect(planning).not.toBeNull();
    expect(planning!.outgoingCandidates).toHaveLength(3);
    expect(
      planning!.outgoingCandidates.some(
        (candidate) => candidate.schoolId === rival!.id,
      ),
    ).toBe(true);

    state.weeklySchedule.practiceMatch = {
      ...state.weeklySchedule.practiceMatch,
      incomingOffer: null,
      scheduledOpponentId: null,
      outgoingCandidates: planning!.outgoingCandidates,
    };
    const recommendation = practicePlanning.selectPracticeRecommendation(state);
    expect(recommendation?.source).toBe("featured-rival");
    expect(recommendation?.candidate.schoolId).toBe(rival!.id);
  });

  it("prioritizes the last practice result over the season ambition", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    state.weeklySchedule.practiceMatch.scheduledOpponentId = null;
    state.seasonGoals = {
      ...state.seasonGoals!,
      ambition: "bold",
    };
    const previous = state.weeklySchedule.practiceMatch.outgoingCandidates[0]!;
    const previousDate = "2026-04-01" as GameDate;
    state.weeklySchedule.recentPracticeMatches = [
      {
        opponentSchoolId: previous.schoolId,
        date: previousDate,
      },
    ];
    state.history.matches.push({
      matchId: matchId("phase29-4-practice-loss"),
      date: previousDate,
      homeSchoolId: state.userSchoolId,
      awaySchoolId: previous.schoolId,
      winnerSchoolId: previous.schoolId,
      homeSetsWon: 0,
      awaySetsWon: 2,
      tournamentId: null,
    });

    const recommendation = practicePlanning.selectPracticeRecommendation(state);

    expect(recommendation?.source).toBe("last-practice-result");
    expect(recommendation?.previousResult?.won).toBe(false);
    expect(recommendation?.tier).toBe(
      practicePlanning.nextPracticeTierFromResult(
        recommendation!.previousResult!.tier,
        false,
      ),
    );
  });

  it.each([
    ["steady", "same"],
    ["challenge", "stronger"],
    ["bold", "challenge"],
  ] as const)(
    "recommends the %s season ambition against the %s practice tier",
    (ambition, expectedTier) => {
      const state = createDemoGame();
      state.weeklySchedule.practiceMatch.incomingOffer = null;
      state.weeklySchedule.practiceMatch.scheduledOpponentId = null;
      state.seasonGoals = {
        ...state.seasonGoals!,
        ambition,
      };

      const recommendation =
        practicePlanning.selectPracticeRecommendation(state);

      expect(recommendation).not.toBeNull();
      expect(recommendation?.ambition).toBe(ambition);
      expect(recommendation?.tier).toBe(expectedTier);
      expect(recommendation?.candidate.status).toBe("available");
    },
  );

  it("falls back to the next ambition tier when the preferred candidate is unavailable", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    state.weeklySchedule.practiceMatch.scheduledOpponentId = null;
    state.seasonGoals = {
      ...state.seasonGoals!,
      ambition: "bold",
    };
    state.weeklySchedule.practiceMatch.outgoingCandidates =
      state.weeklySchedule.practiceMatch.outgoingCandidates.map((candidate) =>
        candidate.tier === "challenge"
          ? { ...candidate, status: "rejected" as const }
          : candidate,
      );

    expect(practicePlanning.selectPracticeRecommendation(state)?.tier).toBe(
      "stronger",
    );
  });

  it("does not recommend another opponent after this week's practice match is complete", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    state.weeklySchedule.practiceMatch.scheduledOpponentId = null;

    const completed = markWeeklyActionCompleted(state, "practice-match");

    expect(practicePlanning.selectPracticeRecommendation(completed)).toBeNull();
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
