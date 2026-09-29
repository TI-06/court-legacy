import type { GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";
import {
  playerOpportunityPromiseLabel,
  selectActivePlayerOpportunityPromises,
} from "./playerOpportunityPromises";

export type PlayerOpportunityRequestKind =
  "promise" | "playing-time" | "role-mismatch";

export interface PlayerOpportunityRequest {
  playerId: PlayerId;
  kind: PlayerOpportunityRequestKind;
  severity: 1 | 2 | 3;
  title: string;
  detail: string;
}

function activeAppearancePromisePlayerIds(state: GameState): Set<PlayerId> {
  const active = new Set<PlayerId>();

  for (const occurrence of state.eventMemory.history) {
    const actor = occurrence.actorPlayerIds[0];
    if (!actor) continue;

    if (
      occurrence.eventId === "event.reserve-role-review" &&
      occurrence.choiceId === "chance"
    ) {
      active.add(actor);
      continue;
    }

    if (occurrence.eventId === "event.reserve-breakthrough") {
      active.delete(actor);
    }
  }

  return active;
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

export function derivePlayerOpportunityRequests(
  state: GameState,
): PlayerOpportunityRequest[] {
  const roster = new Set(state.schools[state.userSchoolId]?.playerIds ?? []);
  const requests = new Map<PlayerId, PlayerOpportunityRequest>();

  for (const promise of selectActivePlayerOpportunityPromises(state)) {
    if (!roster.has(promise.playerId)) continue;
    requests.set(promise.playerId, {
      playerId: promise.playerId,
      kind: "promise",
      severity: 3,
      title: playerOpportunityPromiseLabel(promise.choice),
      detail:
        promise.choice === "starter"
          ? "この試合で先発起用すると約束しています。"
          : promise.choice === "substitute"
            ? "この試合で途中出場の機会を作ると約束しています。"
            : "次の公式戦で起用すると約束しています。",
    });
  }

  for (const playerId of activeAppearancePromisePlayerIds(state)) {
    if (!roster.has(playerId)) continue;
    requests.set(playerId, {
      playerId,
      kind: "promise",
      severity: 3,
      title: "出場機会を約束中",
      detail: "面談で短時間でも試合に出すと約束しています。",
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
