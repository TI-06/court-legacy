import type { GameState } from "../model/GameState";
import type { MatchEvent, MatchState } from "../model/Match";
import { eventId, type PlayerId } from "../model/identifiers";
import {
  deriveActivePlayerOpportunityPromises,
  type PlayerOpportunityPromiseKind,
} from "./playerOpportunityRequests";

export type PlayerOpportunityPromiseOutcomeStatus =
  | "kept"
  | "broken"
  | "excused";

export interface PlayerOpportunityPromiseOutcome {
  playerId: PlayerId;
  promiseKind: PlayerOpportunityPromiseKind;
  status: PlayerOpportunityPromiseOutcomeStatus;
  trustChange: number;
  moraleChange: number;
}

const PROMISE_RESULT_EVENT_ID = eventId("event.reserve-promise-result");

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function userSelection(state: GameState, match: MatchState) {
  if (match.homeSchoolId === state.userSchoolId) return match.homeSelection;
  if (match.awaySchoolId === state.userSchoolId) return match.awaySelection;
  throw new Error("player opportunity promise requires the user match");
}

function userSubstitutionEvents(
  state: GameState,
  match: MatchState,
): MatchEvent[] {
  return match.eventLog.filter(
    (event) =>
      event.type === "substitution" &&
      event.winnerSchoolId === state.userSchoolId &&
      event.actorPlayerId !== null &&
      event.targetPlayerId !== null,
  );
}

function initialActivePlayerIds(
  state: GameState,
  match: MatchState,
): Set<PlayerId> {
  const selection = userSelection(state, match);
  const active = new Set<PlayerId>([
    ...selection.rotation.map((assignment) => assignment.playerId),
    ...(selection.liberoPlayerId ? [selection.liberoPlayerId] : []),
  ]);

  const substitutions = userSubstitutionEvents(state, match);
  for (let index = substitutions.length - 1; index >= 0; index -= 1) {
    const event = substitutions[index]!;
    if (!event.actorPlayerId || !event.targetPlayerId) continue;
    active.delete(event.actorPlayerId);
    active.add(event.targetPlayerId);
  }

  return active;
}

function appearedPlayerIds(
  state: GameState,
  match: MatchState,
  starters: ReadonlySet<PlayerId>,
): Set<PlayerId> {
  const appeared = new Set(starters);
  for (const event of userSubstitutionEvents(state, match)) {
    if (event.actorPlayerId) appeared.add(event.actorPlayerId);
  }
  return appeared;
}

function promiseWasKept(
  promiseKind: PlayerOpportunityPromiseKind,
  playerId: PlayerId,
  starters: ReadonlySet<PlayerId>,
  appeared: ReadonlySet<PlayerId>,
): boolean {
  if (promiseKind === "starter") return starters.has(playerId);
  return appeared.has(playerId);
}

function outcomeChanges(
  promiseKind: PlayerOpportunityPromiseKind,
  status: PlayerOpportunityPromiseOutcomeStatus,
): Pick<PlayerOpportunityPromiseOutcome, "trustChange" | "moraleChange"> {
  if (status === "excused") {
    return { trustChange: 0, moraleChange: 0 };
  }
  if (status === "kept") {
    if (promiseKind === "starter") {
      return { trustChange: 6, moraleChange: 5 };
    }
    if (promiseKind === "substitute") {
      return { trustChange: 5, moraleChange: 4 };
    }
    return { trustChange: 4, moraleChange: 4 };
  }

  if (promiseKind === "starter") {
    return { trustChange: -10, moraleChange: -7 };
  }
  if (promiseKind === "substitute") {
    return { trustChange: -8, moraleChange: -6 };
  }
  return { trustChange: -7, moraleChange: -5 };
}

function resultCode(outcome: PlayerOpportunityPromiseOutcome): string {
  if (outcome.status === "excused") return "起用約束 怪我で見送り";
  if (outcome.status === "kept") {
    return `起用約束 達成 信頼 ${outcome.trustChange >= 0 ? "+" : ""}${outcome.trustChange} 士気 ${outcome.moraleChange >= 0 ? "+" : ""}${outcome.moraleChange}`;
  }
  return `起用約束 未達成 信頼 ${outcome.trustChange} 士気 ${outcome.moraleChange}`;
}

function appendPromiseResultHistory(
  state: GameState,
  outcomes: readonly PlayerOpportunityPromiseOutcome[],
): GameState {
  if (outcomes.length === 0) return state;

  const cancelledFollowUpIds = new Set(
    outcomes
      .filter((outcome) => outcome.status !== "kept")
      .map((outcome) => outcome.playerId),
  );
  const history = [...state.eventMemory.history];

  for (const outcome of outcomes) {
    history.push({
      eventId: PROMISE_RESULT_EVENT_ID,
      date: state.date,
      actorPlayerIds: [outcome.playerId],
      choiceId: `${outcome.status}-${outcome.promiseKind}`,
      visibleResultCodes: [resultCode(outcome)],
    });
  }

  return {
    ...state,
    eventMemory: {
      ...state.eventMemory,
      history: history.slice(-200),
      scheduledFollowUps: state.eventMemory.scheduledFollowUps.filter(
        (followUp) =>
          !(
            followUp.eventId === "event.reserve-breakthrough" &&
            followUp.actorPlayerIds.some((playerId) =>
              cancelledFollowUpIds.has(playerId),
            )
          ),
      ),
    },
  };
}

export function resolvePlayerOpportunityPromisesAfterOfficialMatch(
  state: GameState,
  match: MatchState,
): {
  state: GameState;
  outcomes: PlayerOpportunityPromiseOutcome[];
} {
  const school = state.schools[state.userSchoolId];
  if (!school) return { state, outcomes: [] };

  const roster = new Set(school.playerIds);
  const promises = deriveActivePlayerOpportunityPromises(state).filter(
    (promise) => roster.has(promise.playerId),
  );
  if (promises.length === 0) {
    return { state, outcomes: [] };
  }

  const starters = initialActivePlayerIds(state, match);
  const appeared = appearedPlayerIds(state, match, starters);
  const outcomes: PlayerOpportunityPromiseOutcome[] = [];
  const players = { ...state.players };

  for (const promise of promises) {
    const player = players[promise.playerId];
    if (!player) continue;

    const status: PlayerOpportunityPromiseOutcomeStatus = player.injury
      ? "excused"
      : promiseWasKept(
            promise.promiseKind,
            promise.playerId,
            starters,
            appeared,
          )
        ? "kept"
        : "broken";
    const changes = outcomeChanges(promise.promiseKind, status);
    outcomes.push({
      playerId: promise.playerId,
      promiseKind: promise.promiseKind,
      status,
      ...changes,
    });

    if (changes.trustChange !== 0 || changes.moraleChange !== 0) {
      players[promise.playerId] = {
        ...player,
        trust: clamp100(player.trust + changes.trustChange),
        morale: clamp100(player.morale + changes.moraleChange),
      };
    }
  }

  return {
    state: appendPromiseResultHistory({ ...state, players }, outcomes),
    outcomes,
  };
}

export function latestPlayerOpportunityPromiseOutcomes(
  state: GameState,
): Array<{
  playerId: PlayerId;
  promiseKind: PlayerOpportunityPromiseKind;
  status: PlayerOpportunityPromiseOutcomeStatus;
  resultText: string;
}> {
  const latestDate = [...state.eventMemory.history]
    .reverse()
    .find((occurrence) => occurrence.eventId === PROMISE_RESULT_EVENT_ID)?.date;
  if (!latestDate) return [];

  return state.eventMemory.history.flatMap((occurrence) => {
    if (
      occurrence.eventId !== PROMISE_RESULT_EVENT_ID ||
      occurrence.date !== latestDate
    ) {
      return [];
    }
    const playerId = occurrence.actorPlayerIds[0];
    if (!playerId) return [];

    const [statusRaw, promiseRaw] = occurrence.choiceId.split("-");
    const status =
      statusRaw === "kept" || statusRaw === "broken" || statusRaw === "excused"
        ? statusRaw
        : null;
    const promiseKind =
      promiseRaw === "starter" ||
      promiseRaw === "substitute" ||
      promiseRaw === "appearance"
        ? promiseRaw
        : null;
    if (!status || !promiseKind) return [];

    return [
      {
        playerId,
        promiseKind,
        status,
        resultText: occurrence.visibleResultCodes[0] ?? "",
      },
    ];
  });
}
