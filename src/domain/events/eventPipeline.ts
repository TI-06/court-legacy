import type { GameDataRegistry } from "../../data/dataRegistry";
import { findCurrentTrainingCampActivity } from "../calendar/trainingCampCalendar";
import type { GameState } from "../model/GameState";
import { SeededRandom } from "../random/SeededRandom";
import { selectNextOfficialEvent } from "../tournament/tournamentSelectors";
import { selectFeaturedUserRival } from "../world/rivalryHistory";
import { selectNextEvent } from "./selectEvent";

function hasDueFollowUp(state: GameState): boolean {
  return state.eventMemory.scheduledFollowUps.some(
    (followUp) => followUp.eligibleDate <= state.date,
  );
}

function contextualEventTag(state: GameState): string | undefined {
  if (findCurrentTrainingCampActivity(state)) {
    return "camp-event";
  }

  const nextOfficial = selectNextOfficialEvent(state);
  if (
    !nextOfficial ||
    nextOfficial.kind !== "match" ||
    nextOfficial.weeksUntil !== 1
  ) {
    return undefined;
  }

  const featuredRival = selectFeaturedUserRival(state);
  if (
    featuredRival &&
    nextOfficial.opponent.schoolId === featuredRival.opponentSchoolId
  ) {
    return "rival";
  }

  return "tournament";
}

export function surfaceWeeklyEvent(
  state: GameState,
  data: GameDataRegistry,
): GameState {
  const normalEventCadence = state.calendar.weekOfYear % 3 === 0;
  const requiredTag = contextualEventTag(state);
  const contextualEventDue = requiredTag !== undefined;
  if (
    state.pendingEvent ||
    (!normalEventCadence && !contextualEventDue && !hasDueFollowUp(state))
  ) {
    return state;
  }
  const random = new SeededRandom(state.seed, state.randomCursor);
  return selectNextEvent(state, data, random, {
    allowNormalEvent: normalEventCadence || contextualEventDue,
    requiredTag,
  }).state;
}
