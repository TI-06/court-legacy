import type { GameDataRegistry } from "../../data/dataRegistry";
import type { GameState } from "../model/GameState";
import { SeededRandom } from "../random/SeededRandom";
import { selectNextEvent } from "./selectEvent";

export function surfaceWeeklyEvent(
  state: GameState,
  data: GameDataRegistry,
): GameState {
  const random = new SeededRandom(state.seed, state.randomCursor);
  return selectNextEvent(state, data, random).state;
}
