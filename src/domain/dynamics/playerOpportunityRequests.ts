import type { GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";

export type PlayerOpportunityRequestKind =
  "promise" | "playing-time" | "role-mismatch";

export type AppearancePromiseMode = "starter" | "substitute" | "next-match";

export interface PlayerOpportunityRequest {
  playerId: PlayerId;
  kind: PlayerOpportunityRequestKind;
  severity: 1 | 2 | 3;
  title: string;
  detail: string;
  promiseMode?: AppearancePromiseMode;
}

export function activeAppearancePromises(
  state: GameState,
): Partial<Record<PlayerId, AppearancePromiseMode>> {
  const active: Partial<Record<PlayerId, AppearancePromiseMode>> = {};

  for (const occurrence of state.eventMemory.history) {
    const actor = occurrence.actorPlayerIds[0];
    if (!actor) continue;

    if (occurrence.eventId === "event.reserve-role-review") {
      if (occurrence.choiceId === "starter") {
        active[actor] = "starter";
      } else if (occurrence.choiceId === "chance") {
        active[actor] = "substitute";
      } else if (occurrence.choiceId === "next-match") {
        active[actor] = "next-match";
      } else if (occurrence.choiceId === "patience") {
        delete active[actor];
      }
      continue;
    }

    if (
      occurrence.eventId === "event.reserve-breakthrough" ||
      occurrence.eventId === "event.reserve-appearance-promise-result"
    ) {
      delete active[actor];
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

  for (const [rawPlayerId, promiseMode] of Object.entries(
    activeAppearancePromises(state),
  )) {
    const playerId = rawPlayerId as PlayerId;
    if (!promiseMode || !roster.has(playerId)) continue;
    requests.set(playerId, {
      playerId,
      kind: "promise",
      severity: 3,
      title:
        promiseMode === "starter"
          ? "先発起用を約束中"
          : promiseMode === "substitute"
            ? "途中出場を約束中"
            : "次戦起用を約束中",
      detail:
        promiseMode === "starter"
          ? "次の公式戦で先発起用すると約束しています。"
          : promiseMode === "substitute"
            ? "次の公式戦で途中出場の機会を与えると約束しています。"
            : "次の公式戦で必ず出場機会を与えると約束しています。",
      promiseMode,
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
