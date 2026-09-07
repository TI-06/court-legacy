import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { GameDate } from "../../../../src/domain/model/identifiers";
import {
  PRACTICE_INCOMING_CHANCE,
  buildPracticePlanning,
} from "../../../../src/domain/weekly/practiceMatchPlanning";

const dates = [
  "2026-04-06",
  "2026-04-13",
  "2026-04-20",
  "2026-04-27",
  "2026-05-04",
  "2026-05-11",
  "2026-05-18",
  "2026-05-25",
] as const satisfies readonly GameDate[];

describe("practice-match incoming offer diversity", () => {
  it("rotates incoming offers across several similarly matched schools", () => {
    const state = createDemoGame();
    const reputation = state.schools[state.userSchoolId]!.reputation;
    const originalChance = PRACTICE_INCOMING_CHANCE[reputation];
    PRACTICE_INCOMING_CHANCE[reputation] = 100;

    try {
      const opponents = dates.map((date, index) => {
        const weeklyState = {
          ...state,
          date,
          calendar: {
            ...state.calendar,
            currentDate: date,
            weekOfYear: index + 1,
          },
        };
        return buildPracticePlanning(weeklyState).incomingOffer?.schoolId ?? null;
      });

      expect(opponents.every(Boolean)).toBe(true);
      expect(new Set(opponents).size).toBeGreaterThanOrEqual(3);
    } finally {
      PRACTICE_INCOMING_CHANCE[reputation] = originalChance;
    }
  });

  it("avoids immediately offering a school that was just played", () => {
    const state = createDemoGame();
    const reputation = state.schools[state.userSchoolId]!.reputation;
    const originalChance = PRACTICE_INCOMING_CHANCE[reputation];
    PRACTICE_INCOMING_CHANCE[reputation] = 100;

    try {
      const firstDate = dates[0];
      const firstState = {
        ...state,
        date: firstDate,
        calendar: { ...state.calendar, currentDate: firstDate, weekOfYear: 1 },
      };
      const firstOpponent = buildPracticePlanning(firstState).incomingOffer;
      expect(firstOpponent).not.toBeNull();

      const secondDate = dates[1];
      const secondState = {
        ...state,
        date: secondDate,
        calendar: { ...state.calendar, currentDate: secondDate, weekOfYear: 2 },
        weeklySchedule: {
          ...state.weeklySchedule,
          recentPracticeMatches: [
            {
              opponentSchoolId: firstOpponent!.schoolId,
              date: firstDate,
            },
          ],
        },
      };
      const secondOpponent = buildPracticePlanning(secondState).incomingOffer;

      expect(secondOpponent).not.toBeNull();
      expect(secondOpponent!.schoolId).not.toBe(firstOpponent!.schoolId);
    } finally {
      PRACTICE_INCOMING_CHANCE[reputation] = originalChance;
    }
  });
});
