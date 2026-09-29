import type { GameState } from "../model/GameState";
import type { MatchState } from "../model/Match";
import type { TeamSelection } from "../model/TeamSelection";
import { eventId, type PlayerId } from "../model/identifiers";

export type PlayerOpportunityResponseChoice =
  | "starter"
  | "substitute"
  | "next-match"
  | "decline";

export interface PlayerOpportunityResponse {
  playerId: PlayerId;
  choice: PlayerOpportunityResponseChoice;
}

interface ActivePlayerOpportunityPromise {
  playerId: PlayerId;
  choice: Exclude<PlayerOpportunityResponseChoice, "decline">;
}

const RESPONSE_EVENT_ID = eventId("event.player-opportunity-response");
const OUTCOME_EVENT_ID = eventId("event.player-opportunity-outcome");

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function appendHistory(
  state: GameState,
  playerId: PlayerId,
  event: "response" | "outcome",
  choiceId: string,
): GameState {
  return {
    ...state,
    eventMemory: {
      ...state.eventMemory,
      history: [
        ...state.eventMemory.history,
        {
          eventId: event === "response" ? RESPONSE_EVENT_ID : OUTCOME_EVENT_ID,
          date: state.date,
          actorPlayerIds: [playerId],
          choiceId,
          visibleResultCodes: [],
        },
      ],
    },
  };
}

function adjustPlayerRelationship(
  state: GameState,
  playerId: PlayerId,
  trustDelta: number,
  moraleDelta: number,
): GameState {
  const player = state.players[playerId];
  if (!player) return state;
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        trust: clamp100(player.trust + trustDelta),
        morale: clamp100(player.morale + moraleDelta),
      },
    },
  };
}

function activeSelectionPlayerIds(selection: TeamSelection): Set<PlayerId> {
  return new Set([
    ...selection.rotation.map((assignment) => assignment.playerId),
    ...(selection.liberoPlayerId ? [selection.liberoPlayerId] : []),
  ]);
}

export function selectActivePlayerOpportunityPromises(
  state: GameState,
): ActivePlayerOpportunityPromise[] {
  const active = new Map<PlayerId, ActivePlayerOpportunityPromise>();

  for (const occurrence of state.eventMemory.history) {
    const playerId = occurrence.actorPlayerIds[0];
    if (!playerId) continue;

    if (
      occurrence.eventId === "event.reserve-role-review" &&
      occurrence.choiceId === "chance"
    ) {
      active.set(playerId, { playerId, choice: "substitute" });
      continue;
    }

    if (occurrence.eventId === "event.reserve-breakthrough") {
      active.delete(playerId);
      continue;
    }

    if (occurrence.eventId === RESPONSE_EVENT_ID) {
      if (
        occurrence.choiceId === "starter" ||
        occurrence.choiceId === "substitute" ||
        occurrence.choiceId === "next-match"
      ) {
        active.set(playerId, {
          playerId,
          choice: occurrence.choiceId,
        });
      } else if (occurrence.choiceId === "decline") {
        active.delete(playerId);
      }
      continue;
    }

    if (occurrence.eventId === OUTCOME_EVENT_ID) {
      if (
        occurrence.choiceId === "kept" ||
        occurrence.choiceId === "broken" ||
        occurrence.choiceId === "declined" ||
        occurrence.choiceId === "promoted-next-match"
      ) {
        active.delete(playerId);
      }
    }
  }

  return [...active.values()];
}

function resolveStarterPromise(
  state: GameState,
  playerId: PlayerId,
  fulfilled: boolean,
): GameState {
  let next = adjustPlayerRelationship(
    state,
    playerId,
    fulfilled ? 3 : -5,
    fulfilled ? 2 : -3,
  );
  next = appendHistory(
    next,
    playerId,
    "outcome",
    fulfilled ? "kept" : "broken",
  );
  return next;
}

export function applyPlayerOpportunityResponses(
  state: GameState,
  selection: TeamSelection,
  responses: readonly PlayerOpportunityResponse[],
): GameState {
  let next = state;
  const roster = new Set(
    state.schools[state.userSchoolId]?.playerIds ?? [],
  );
  const activeIds = activeSelectionPlayerIds(selection);

  for (const response of responses) {
    if (!roster.has(response.playerId)) continue;

    next = appendHistory(next, response.playerId, "response", response.choice);

    if (response.choice === "starter") {
      next = resolveStarterPromise(
        next,
        response.playerId,
        activeIds.has(response.playerId),
      );
    } else if (response.choice === "decline") {
      next = adjustPlayerRelationship(next, response.playerId, -2, -1);
      next = appendHistory(next, response.playerId, "outcome", "declined");
    }
  }

  for (const promise of selectActivePlayerOpportunityPromises(next)) {
    if (promise.choice !== "starter") continue;
    next = resolveStarterPromise(
      next,
      promise.playerId,
      activeIds.has(promise.playerId),
    );
  }

  return next;
}

function substitutedIntoMatch(
  state: GameState,
  match: MatchState,
  playerId: PlayerId,
): boolean {
  return match.eventLog.some(
    (event) =>
      event.type === "substitution" &&
      event.winnerSchoolId === state.userSchoolId &&
      event.actorPlayerId === playerId,
  );
}

export function resolveCompletedMatchOpportunityPromises(
  state: GameState,
  match: MatchState,
): GameState {
  let next = state;

  for (const promise of selectActivePlayerOpportunityPromises(state)) {
    if (promise.choice === "substitute") {
      const fulfilled = substitutedIntoMatch(state, match, promise.playerId);
      next = adjustPlayerRelationship(
        next,
        promise.playerId,
        fulfilled ? 3 : -5,
        fulfilled ? 2 : -3,
      );
      next = appendHistory(
        next,
        promise.playerId,
        "outcome",
        fulfilled ? "kept" : "broken",
      );
      continue;
    }

    if (promise.choice === "next-match") {
      next = appendHistory(
        next,
        promise.playerId,
        "outcome",
        "promoted-next-match",
      );
      next = appendHistory(next, promise.playerId, "response", "starter");
    }
  }

  return next;
}

export function playerOpportunityPromiseLabel(
  choice: Exclude<PlayerOpportunityResponseChoice, "decline">,
): string {
  switch (choice) {
    case "starter":
      return "先発起用を約束中";
    case "substitute":
      return "途中出場を約束中";
    case "next-match":
      return "次の公式戦で起用を約束中";
  }
}
