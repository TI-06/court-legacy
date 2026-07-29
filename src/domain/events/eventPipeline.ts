import type { GameDataRegistry } from "../../data/dataRegistry";
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
  if (
    state.pendingEvent ||
    (state.calendar.weekOfYear % 3 !== 0 && !hasDueFollowUp(state))
  ) {
    return state;
  }
  const random = new SeededRandom(state.seed, state.randomCursor);
  return selectNextEvent(state, data, random).state;
}
