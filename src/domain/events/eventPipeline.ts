import type { GameDataRegistry } from "../../data/dataRegistry";
import { findCurrentTrainingCampActivity } from "../calendar/trainingCampCalendar";
import type { GameState } from "../model/GameState";
import { SeededRandom } from "../random/SeededRandom";
import { selectNextEvent } from "./selectEvent";

function hasDueFollowUp(state: GameState): boolean {
  return state.eventMemory.scheduledFollowUps.some(
    (followUp) => followUp.eligibleDate <= state.date,
  );
}

export function surfaceWeeklyEvent(
  state: GameState,
  data: GameDataRegistry,
): GameState {
  const normalEventCadence = state.calendar.weekOfYear % 3 === 0;
  const campActivity = findCurrentTrainingCampActivity(state);
  const campEventDue = campActivity !== null;
  if (
    state.pendingEvent ||
    (!normalEventCadence && !campEventDue && !hasDueFollowUp(state))
  ) {
    return state;
  }
  const random = new SeededRandom(state.seed, state.randomCursor);
  return selectNextEvent(state, data, random, {
    allowNormalEvent: normalEventCadence || campEventDue,
    requiredTag: campEventDue ? "camp-event" : undefined,
  }).state;
}
