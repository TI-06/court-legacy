import { createDemoGame, gameData } from "../../src/app/createDemoGame";
import { surfaceWeeklyEvent } from "../../src/domain/events/eventPipeline";
import { resolveEventChoice } from "../../src/domain/events/resolveEventChoice";
import { eventId } from "../../src/domain/model/identifiers";
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

  it("forces a camp-only event on an off-cadence camp week", () => {
    const state = createDemoGame();
    const camp = state.calendar.activities.find(
      (activity) => activity.type === "camp",
    );
    if (!camp) {
      throw new Error("camp fixture missing");
    }
    state.date = camp.date;
    state.calendar.currentDate = camp.date;
    state.calendar.weekOfYear = Number(camp.metadata.weekOfYear);

    expect(state.calendar.weekOfYear % 3).not.toBe(0);

    const surfaced = surfaceWeeklyEvent(state, gameData);
    expect(surfaced.pendingEvent).not.toBeNull();
    const definition = gameData.events.get(surfaced.pendingEvent!.eventId);
    expect(definition?.tags).toContain("camp-event");
    expect(definition?.trigger.tournamentStages).toContain("camp");
  });

  it("does not force a normal event every week", () => {
    const state = createDemoGame();
    state.calendar.weekOfYear = 2;

    expect(surfaceWeeklyEvent(state, gameData).pendingEvent).toBeNull();
  });

  it("does not fall back to a normal event when an off-cadence follow-up is invalid", () => {
    const state = createDemoGame();
    state.calendar.weekOfYear = 2;
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.eventMemory.scheduledFollowUps = [
      {
        eventId: eventId("event.invalid-follow-up"),
        eligibleDate: state.date,
        actorPlayerIds: [playerId],
        chainId: "test-chain",
        chainStage: 2,
      },
    ];

    const surfaced = surfaceWeeklyEvent(state, gameData);

    expect(surfaced.pendingEvent).toBeNull();
    expect(surfaced.eventMemory.scheduledFollowUps).toEqual([]);
  });
});
