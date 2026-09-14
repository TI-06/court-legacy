from pathlib import Path

Path("tests/unit/domain/weekly/phase20PracticeOfferLongRun.test.ts").write_text(r'''import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { GameState } from "../../../../src/domain/model/GameState";
import type {
  GameDate,
  SchoolId,
} from "../../../../src/domain/model/identifiers";
import { calculateTournamentSchoolStrength } from "../../../../src/domain/tournament/createOfficialSeason";
import {
  buildPracticePlanning,
  PRACTICE_INCOMING_MONTHLY_LIMIT,
  practiceOfferMonthKey,
} from "../../../../src/domain/weekly/practiceMatchPlanning";
import type { IncomingPracticeOfferHistoryEntry } from "../../../../src/domain/weekly/weeklyScheduleTypes";
import { rivalryKey } from "../../../../src/domain/world/rivalWorldProgression";

interface LongRunMetrics {
  seed: string;
  weeks: number;
  months: number;
  totalOffers: number;
  uniqueOpponents: number;
  maximumMonthlyOffers: number;
  maximumSingleSchoolShare: number;
  backToBackSameSchoolCount: number;
  cooldownViolations: number;
  rivalOfferCount: number;
}

function addDays(date: GameDate, days: number): GameDate {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10) as GameDate;
}

function strongestEligibleRival(state: GameState): SchoolId {
  const home = state.schools[state.userSchoolId]!;
  const homeStrength = calculateTournamentSchoolStrength(state, home);
  return Object.values(state.schools)
    .filter((school) => school.id !== state.userSchoolId)
    .map((school) => ({
      schoolId: school.id,
      distance: Math.abs(
        calculateTournamentSchoolStrength(state, school) / Math.max(1, homeStrength) -
          1.15,
      ),
    }))
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.schoolId.localeCompare(right.schoolId),
    )[0]!.schoolId;
}

function runLongSimulation(seed: string): LongRunMetrics {
  let state = structuredClone(createDemoGame());
  state.seed = seed;
  const home = state.schools[state.userSchoolId]!;
  state.schools[state.userSchoolId] = {
    ...home,
    reputation: "elite",
  };
  const rivalId = strongestEligibleRival(state);
  state.world = {
    ...state.world,
    rivalryScores: {
      ...state.world.rivalryScores,
      [rivalryKey(state.userSchoolId, rivalId)]: 100,
    },
    destinyRivalSchoolId: rivalId,
  };
  state.weeklySchedule = {
    ...state.weeklySchedule,
    incomingPracticeOfferHistory: [],
    recentPracticeMatches: [],
  };

  const start = "2026-04-01" as GameDate;
  const weeks = 104;
  const offers: IncomingPracticeOfferHistoryEntry[] = [];
  const monthlyCounts = new Map<string, number>();
  const schoolCounts = new Map<SchoolId, number>();
  let backToBackSameSchoolCount = 0;
  let cooldownViolations = 0;
  let rivalOfferCount = 0;
  let previousOffer: IncomingPracticeOfferHistoryEntry | null = null;
  const lastOfferBySchool = new Map<SchoolId, GameDate>();

  for (let week = 0; week < weeks; week += 1) {
    const date = addDays(start, week * 7);
    state = {
      ...state,
      date,
      calendar: {
        ...state.calendar,
        currentDate: date,
      },
      weeklySchedule: {
        ...state.weeklySchedule,
        incomingPracticeOfferHistory: offers.slice(-32),
      },
    };

    const planning = buildPracticePlanning(state);
    const offer = planning.incomingOffer;
    if (!offer) continue;

    const entry = planning.incomingPracticeOfferHistory.at(-1)!;
    expect(entry.schoolId).toBe(offer.schoolId);
    expect(entry.surfacedDate).toBe(date);

    const priorDate = lastOfferBySchool.get(offer.schoolId);
    if (priorDate) {
      const differenceDays =
        (Date.parse(`${date}T00:00:00.000Z`) -
          Date.parse(`${priorDate}T00:00:00.000Z`)) /
        (24 * 60 * 60 * 1000);
      if (differenceDays <= 56) cooldownViolations += 1;
    }
    if (previousOffer?.schoolId === offer.schoolId) {
      backToBackSameSchoolCount += 1;
    }

    offers.push(entry);
    previousOffer = entry;
    lastOfferBySchool.set(offer.schoolId, date);
    const month = practiceOfferMonthKey(date);
    monthlyCounts.set(month, (monthlyCounts.get(month) ?? 0) + 1);
    schoolCounts.set(
      offer.schoolId,
      (schoolCounts.get(offer.schoolId) ?? 0) + 1,
    );
    if (offer.schoolId === rivalId) rivalOfferCount += 1;
  }

  const maximumMonthlyOffers = Math.max(0, ...monthlyCounts.values());
  const maximumSchoolOffers = Math.max(0, ...schoolCounts.values());
  const maximumSingleSchoolShare =
    offers.length === 0 ? 0 : maximumSchoolOffers / offers.length;

  return {
    seed,
    weeks,
    months: monthlyCounts.size,
    totalOffers: offers.length,
    uniqueOpponents: schoolCounts.size,
    maximumMonthlyOffers,
    maximumSingleSchoolShare,
    backToBackSameSchoolCount,
    cooldownViolations,
    rivalOfferCount,
  };
}

describe("Phase20-3 long-run practice offer cadence and diversity", () => {
  it.each(["phase20-longrun-a", "phase20-longrun-b"])(
    "keeps 24-month incoming offers bounded and distributed for %s",
    (seed) => {
      const metrics = runLongSimulation(seed);
      console.log(`PHASE20_LONGRUN ${JSON.stringify(metrics)}`);

      expect(metrics.totalOffers).toBeGreaterThan(12);
      expect(metrics.maximumMonthlyOffers).toBeLessThanOrEqual(
        PRACTICE_INCOMING_MONTHLY_LIMIT,
      );
      expect(metrics.cooldownViolations).toBe(0);
      expect(metrics.backToBackSameSchoolCount).toBe(0);
      expect(metrics.uniqueOpponents).toBeGreaterThanOrEqual(6);
      expect(metrics.maximumSingleSchoolShare).toBeLessThanOrEqual(0.35);
      expect(metrics.rivalOfferCount).toBeGreaterThan(0);
    },
  );
});
''', encoding="utf-8")
print("Phase20-3 long-run evidence test staged")
