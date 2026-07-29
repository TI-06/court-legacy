import { createDemoGame, gameData } from "../../src/app/createDemoGame";
import { surfaceWeeklyEvent } from "../../src/domain/events/eventPipeline";
import { resolveEventChoice } from "../../src/domain/events/resolveEventChoice";
import { SeededRandom } from "../../src/domain/random/SeededRandom";

describe("event pipeline", () => {
  it("surfaces at the configured cadence and resolves into history", () => {
    const state = createDemoGame();
    state.calendar.weekOfYear = 3;

    const surfaced = surfaceWeeklyEvent(state, gameData);
    expect(surfaced.pendingEvent).not.toBeNull();
    const choiceId = surfaced.pendingEvent?.choiceIds[0];
    if (!choiceId) {
      throw new Error("event choice missing");
    }

    const resolved = resolveEventChoice(
      surfaced,
      choiceId,
      gameData,
      new SeededRandom(surfaced.seed, surfaced.randomCursor),
    ).state;

    expect(resolved.pendingEvent).toBeNull();
    expect(resolved.eventMemory.history).toHaveLength(1);
  });

  it("does not force a normal event every week", () => {
    const state = createDemoGame();
    state.calendar.weekOfYear = 2;

    expect(surfaceWeeklyEvent(state, gameData).pendingEvent).toBeNull();
  });
});
