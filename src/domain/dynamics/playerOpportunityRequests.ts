import type { GameState } from "../model/GameState";
import type { GameDate, PlayerId } from "../model/identifiers";

export type PlayerOpportunityRequestKind =
  "promise" | "playing-time" | "role-mismatch";

export type PlayerOpportunityPromiseKind =
  "starter" | "substitute" | "appearance";

export interface ActivePlayerOpportunityPromise {
  playerId: PlayerId;
  promiseKind: PlayerOpportunityPromiseKind;
  promisedDate: GameDate;
  choiceId: string;
}

export interface PlayerOpportunityRequest {
  playerId: PlayerId;
  kind: PlayerOpportunityRequestKind;
  severity: 1 | 2 | 3;
  title: string;
  detail: string;
  promiseKind?: PlayerOpportunityPromiseKind;
}

function promiseKindForChoice(
  choiceId: string,
): PlayerOpportunityPromiseKind | null {
  if (choiceId === "start-next") return "starter";
  if (choiceId === "sub-next") return "substitute";
  if (choiceId === "appearance-next" || choiceId === "chance") {
    return "appearance";
  }
  return null;
}

export function deriveActivePlayerOpportunityPromises(
  state: GameState,
): ActivePlayerOpportunityPromise[] {
  const active = new Map<PlayerId, ActivePlayerOpportunityPromise>();

  for (const occurrence of state.eventMemory.history) {
    const actor = occurrence.actorPlayerIds[0];
    if (!actor) continue;

    if (occurrence.eventId === "event.reserve-role-review") {
      const promiseKind = promiseKindForChoice(occurrence.choiceId);
      if (promiseKind) {
        active.set(actor, {
          playerId: actor,
          promiseKind,
          promisedDate: occurrence.date,
          choiceId: occurrence.choiceId,
        });
      } else {
        active.delete(actor);
      }
      continue;
    }

    if (occurrence.eventId === "event.reserve-promise-result") {
      active.delete(actor);
      continue;
    }

    // Legacy saves used reserve-breakthrough as the end of the old "chance"
    // promise. New promise choices are resolved by the next official match.
    if (
      occurrence.eventId === "event.reserve-breakthrough" &&
      active.get(actor)?.choiceId === "chance"
    ) {
      active.delete(actor);
    }
  }

  return [...active.values()].sort(
    (left, right) =>
      left.promisedDate.localeCompare(right.promisedDate) ||
      String(left.playerId).localeCompare(String(right.playerId)),
  );
}

function concernRequest(
  playerId: PlayerId,
  code: "playing-time" | "role-mismatch",
  severity: 1 | 2 | 3,
): PlayerOpportunityRequest {
  return code === "playing-time"
    ? {
        playerId,
        kind: "playing-time",
        severity,
        title: "出場機会が欲しい",
        detail:
          severity >= 3
            ? "最近の公式戦でほとんど起用されていません。"
            : "最近の出場機会が少なく、起用を求めています。",
      }
    : {
        playerId,
        kind: "role-mismatch",
        severity,
        title: "役割を見直してほしい",
        detail: "実力に対して現在の役割が小さいと感じています。",
      };
}

function promisePresentation(
  promise: ActivePlayerOpportunityPromise,
): Pick<PlayerOpportunityRequest, "title" | "detail"> {
  if (promise.choiceId === "chance") {
    return {
      title: "出場機会を約束中",
      detail: "面談で短時間でも試合に出すと約束しています。",
    };
  }
  if (promise.promiseKind === "starter") {
    return {
      title: "先発起用を約束中",
      detail: "次の公式戦では先発で使うと約束しています。",
    };
  }
  if (promise.promiseKind === "substitute") {
    return {
      title: "途中出場を約束中",
      detail: "次の公式戦で途中出場の機会を作ると約束しています。",
    };
  }
  return {
    title: "次戦起用を約束中",
    detail: "次の公式戦で出場機会を作ると約束しています。",
  };
}

export function derivePlayerOpportunityRequests(
  state: GameState,
): PlayerOpportunityRequest[] {
  const roster = new Set(state.schools[state.userSchoolId]?.playerIds ?? []);
  const requests = new Map<PlayerId, PlayerOpportunityRequest>();

  for (const promise of deriveActivePlayerOpportunityPromises(state)) {
    if (!roster.has(promise.playerId)) continue;
    const presentation = promisePresentation(promise);
    requests.set(promise.playerId, {
      playerId: promise.playerId,
      kind: "promise",
      severity: 3,
      title: presentation.title,
      detail: presentation.detail,
      promiseKind: promise.promiseKind,
    });
  }

  for (const [rawPlayerId, concerns] of Object.entries(
    state.teamDynamics.playerConcerns,
  )) {
    const playerId = rawPlayerId as PlayerId;
    if (!roster.has(playerId)) continue;

    for (const concern of concerns ?? []) {
      if (concern.code !== "playing-time" && concern.code !== "role-mismatch") {
        continue;
      }
      if (requests.get(playerId)?.kind === "promise") {
        continue;
      }

      const next = concernRequest(playerId, concern.code, concern.severity);
      const current = requests.get(playerId);
      if (!current || next.severity > current.severity) {
        requests.set(playerId, next);
      }
    }
  }

  return [...requests.values()].sort((left, right) => {
    const severity = right.severity - left.severity;
    if (severity !== 0) return severity;
    if (left.kind === "promise" && right.kind !== "promise") return -1;
    if (right.kind === "promise" && left.kind !== "promise") return 1;
    return left.playerId.localeCompare(right.playerId);
  });
}

export function opportunityRequestByPlayerId(
  state: GameState,
): Partial<Record<PlayerId, PlayerOpportunityRequest>> {
  return Object.fromEntries(
    derivePlayerOpportunityRequests(state).map((request) => [
      request.playerId,
      request,
    ]),
  ) as Partial<Record<PlayerId, PlayerOpportunityRequest>>;
}
