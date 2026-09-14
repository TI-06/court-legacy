import type { PlayerId } from "../model/identifiers";
import type { PlayerConcernCode, TeamDynamicsState } from "./teamDynamicsTypes";

export interface ResolvedPlayerConcern {
  playerId: PlayerId;
  code: PlayerConcernCode;
}

export function selectResolvedPlayerConcerns(
  before: TeamDynamicsState["playerConcerns"],
  after: TeamDynamicsState["playerConcerns"],
): ResolvedPlayerConcern[] {
  const resolved: ResolvedPlayerConcern[] = [];

  for (const [rawPlayerId, previousConcerns] of Object.entries(before)) {
    const playerId = rawPlayerId as PlayerId;
    const currentCodes = new Set(
      (after[playerId] ?? []).map((concern) => concern.code),
    );

    for (const concern of previousConcerns ?? []) {
      if (!currentCodes.has(concern.code)) {
        resolved.push({ playerId, code: concern.code });
      }
    }
  }

  return resolved.sort(
    (left, right) =>
      String(left.playerId).localeCompare(String(right.playerId)) ||
      left.code.localeCompare(right.code),
  );
}
