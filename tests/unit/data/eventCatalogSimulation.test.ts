import { createDemoGame, gameData } from "../../../src/app/createDemoGame";
import { addWeeks } from "../../../src/domain/events/eventDate";
import { surfaceWeeklyEvent } from "../../../src/domain/events/eventPipeline";
import { resolveEventChoice } from "../../../src/domain/events/resolveEventChoice";
import { SeededRandom } from "../../../src/domain/random/SeededRandom";

const YEARS = 100;
const WEEKS_PER_YEAR = 52;

describe("event catalog long-run simulation", () => {
  it(
    "keeps root event cadence meaningful for 100 years without exhausting choices",
    () => {
      let state = createDemoGame();
      let rootOccurrences = 0;
      let chainOccurrences = 0;
      const occurredEventIds = new Set<string>();

      for (let week = 1; week <= YEARS * WEEKS_PER_YEAR; week += 1) {
        const nextDate = addWeeks(state.date, 1);
        state = {
          ...state,
          date: nextDate,
          calendar: {
            ...state.calendar,
            currentDate: nextDate,
            weekOfYear: ((week - 1) % WEEKS_PER_YEAR) + 1,
          },
        };
        state = surfaceWeeklyEvent(state, gameData);

        if (!state.pendingEvent) {
          continue;
        }

        occurredEventIds.add(state.pendingEvent.eventId);
        if (state.pendingEvent.chainId) {
          chainOccurrences += 1;
        } else {
          rootOccurrences += 1;
        }

        const choiceId =
          state.pendingEvent.choiceIds[
            week % state.pendingEvent.choiceIds.length
          ];
        expect(choiceId).toBeDefined();
        state = resolveEventChoice(
          state,
          choiceId!,
          gameData,
          new SeededRandom(state.seed, state.randomCursor),
        ).state;
      }

      const rootEventsPerYear = rootOccurrences / YEARS;
      expect(rootEventsPerYear).toBeGreaterThanOrEqual(10);
      expect(rootEventsPerYear).toBeLessThanOrEqual(18);
      expect(chainOccurrences).toBeGreaterThan(0);
      expect(occurredEventIds.size).toBeGreaterThanOrEqual(30);
    },
    15_000,
  );
});
