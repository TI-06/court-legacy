import { selectPlayerConcernGuidance } from "../dynamics/playerConcernGuidance";
import type { PlayerConcernCode } from "../dynamics/teamDynamicsTypes";
import type { GameState } from "../model/GameState";
import type { Player } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { RotationSlot, TeamSelection } from "../model/TeamSelection";
import { calculatePlayerDisplayPower } from "../selectors/playerPresentation";
import { repositionTeamSelection } from "../team/repositionTeamSelection";

const slotRoles: Record<RotationSlot, Player["preferredPosition"]> = {
  1: "S",
  2: "MB",
  3: "MB",
  4: "OH",
  5: "OH",
  6: "OP",
};

export interface PreMatchPlayerRequest {
  playerId: PlayerId;
  playerName: string;
  code: PlayerConcernCode;
  severity: 1 | 2 | 3;
  title: string;
  progressLabel: string;
  resolution: string;
  actionable: boolean;
}

function activePlayerIds(selection: TeamSelection): Set<PlayerId> {
  const ids = selection.rotation.map((item) => item.playerId);
  if (selection.liberoPlayerId) ids.push(selection.liberoPlayerId);
  return new Set(ids);
}

function displayPower(player: Player | undefined): number {
  return player ? calculatePlayerDisplayPower(player) : 0;
}

export function selectPreMatchPlayerRequests(
  state: GameState,
): PreMatchPlayerRequest[] {
  const school = state.schools[state.userSchoolId];
  if (!school) return [];

  return school.playerIds
    .flatMap((playerId) => {
      const player = state.players[playerId];
      if (!player) return [];
      return selectPlayerConcernGuidance(state, playerId).map((guidance) => ({
        playerId,
        playerName: `${player.lastName} ${player.firstName}`,
        code: guidance.code,
        severity: guidance.severity,
        title: guidance.title,
        progressLabel: guidance.progressLabel,
        resolution: guidance.resolution,
        actionable:
          guidance.code === "playing-time" ||
          guidance.code === "role-mismatch" ||
          guidance.code === "injury-overuse",
      }));
    })
    .sort(
      (left, right) =>
        right.severity - left.severity ||
        left.playerName.localeCompare(right.playerName, "ja"),
    );
}

function bestRotationSlotForIncoming(
  state: GameState,
  selection: TeamSelection,
  incomingPlayer: Player,
  protectedIds: ReadonlySet<PlayerId>,
): RotationSlot | null {
  const candidates = selection.rotation
    .filter((assignment) => !protectedIds.has(assignment.playerId))
    .map((assignment) => {
      const outgoingPlayer = state.players[assignment.playerId];
      const role = slotRoles[assignment.slot];
      return {
        slot: assignment.slot,
        aptitude: incomingPlayer.positionAptitudes[role] ?? 0,
        outgoingPower: displayPower(outgoingPlayer),
      };
    })
    .sort(
      (left, right) =>
        right.aptitude - left.aptitude ||
        left.outgoingPower - right.outgoingPower ||
        left.slot - right.slot,
    );

  return candidates[0]?.slot ?? null;
}

function bestBenchReplacementForSlot(
  state: GameState,
  selection: TeamSelection,
  slot: RotationSlot,
  excludedIds: ReadonlySet<PlayerId>,
): PlayerId | null {
  const role = slotRoles[slot];
  const candidates = selection.benchPlayerIds
    .filter((playerId) => !excludedIds.has(playerId))
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => Boolean(player) && !player.injury)
    .sort(
      (left, right) =>
        (right.positionAptitudes[role] ?? 0) -
          (left.positionAptitudes[role] ?? 0) ||
        displayPower(right) - displayPower(left) ||
        left.id.localeCompare(right.id),
    );
  return candidates[0]?.id ?? null;
}

function bestBenchLibero(
  state: GameState,
  selection: TeamSelection,
  excludedIds: ReadonlySet<PlayerId>,
): PlayerId | null {
  const candidates = selection.benchPlayerIds
    .filter((playerId) => !excludedIds.has(playerId))
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => Boolean(player) && !player.injury)
    .sort(
      (left, right) =>
        (right.positionAptitudes.L ?? 0) - (left.positionAptitudes.L ?? 0) ||
        displayPower(right) - displayPower(left) ||
        left.id.localeCompare(right.id),
    );
  return candidates[0]?.id ?? null;
}

export function applyPreMatchPlayerRequests(
  state: GameState,
  selection: TeamSelection,
): TeamSelection {
  let next = structuredClone(selection);
  const requests = selectPreMatchPlayerRequests(state);
  const protectedIds = new Set<PlayerId>();

  for (const request of requests) {
    const player = state.players[request.playerId];
    if (!player || !request.actionable) continue;

    const activeIds = activePlayerIds(next);

    if (
      request.code === "playing-time" ||
      request.code === "role-mismatch"
    ) {
      if (activeIds.has(player.id) || !next.benchPlayerIds.includes(player.id)) {
        if (activeIds.has(player.id)) protectedIds.add(player.id);
        continue;
      }

      if (player.preferredPosition === "L") {
        const moved = repositionTeamSelection({
          selection: next,
          source: { type: "bench", playerId: player.id },
          target: { type: "libero" },
        });
        if (moved) {
          next = moved;
          protectedIds.add(player.id);
        }
        continue;
      }

      const slot = bestRotationSlotForIncoming(
        state,
        next,
        player,
        protectedIds,
      );
      if (slot === null) continue;
      const moved = repositionTeamSelection({
        selection: next,
        source: { type: "bench", playerId: player.id },
        target: { type: "rotation", slot },
      });
      if (moved) {
        next = moved;
        protectedIds.add(player.id);
      }
      continue;
    }

    if (request.code === "injury-overuse" && player.injury) {
      const rotationAssignment = next.rotation.find(
        (assignment) => assignment.playerId === player.id,
      );
      if (rotationAssignment) {
        const replacementId = bestBenchReplacementForSlot(
          state,
          next,
          rotationAssignment.slot,
          protectedIds,
        );
        if (!replacementId) continue;
        const moved = repositionTeamSelection({
          selection: next,
          source: { type: "bench", playerId: replacementId },
          target: { type: "rotation", slot: rotationAssignment.slot },
        });
        if (moved) next = moved;
        continue;
      }

      if (next.liberoPlayerId === player.id) {
        const replacementId = bestBenchLibero(state, next, protectedIds);
        if (!replacementId) continue;
        const moved = repositionTeamSelection({
          selection: next,
          source: { type: "bench", playerId: replacementId },
          target: { type: "libero" },
        });
        if (moved) next = moved;
      }
    }
  }

  return next;
}
