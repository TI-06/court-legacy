import type { RotationSlot, TeamSelection } from "../model/TeamSelection";
import type { PlayerId } from "../model/identifiers";

export type TeamPlacement =
  | { type: "rotation"; slot: RotationSlot }
  | { type: "libero" }
  | { type: "bench"; playerId: PlayerId };

export interface RepositionTeamSelectionInput {
  selection: TeamSelection;
  source: TeamPlacement;
  target: TeamPlacement;
}

function cloneSelection(selection: TeamSelection): TeamSelection {
  return {
    rotation: selection.rotation.map((assignment) => ({ ...assignment })),
    liberoPlayerId: selection.liberoPlayerId,
    benchPlayerIds: [...selection.benchPlayerIds],
    servingOrderPlayerIds: [...selection.servingOrderPlayerIds],
    substitutionPolicy: {
      ...selection.substitutionPolicy,
      starterLockPlayerIds: [
        ...selection.substitutionPolicy.starterLockPlayerIds,
      ],
    },
  };
}

function rotationPlayer(
  selection: TeamSelection,
  slot: RotationSlot,
): PlayerId | null {
  return (
    selection.rotation.find((assignment) => assignment.slot === slot)
      ?.playerId ?? null
  );
}

function replaceServer(
  servingOrderPlayerIds: PlayerId[],
  outgoingId: PlayerId,
  incomingId: PlayerId,
): PlayerId[] {
  return servingOrderPlayerIds.map((playerId) =>
    playerId === outgoingId ? incomingId : playerId,
  );
}

function removeStarterLock(selection: TeamSelection, playerId: PlayerId): void {
  selection.substitutionPolicy.starterLockPlayerIds =
    selection.substitutionPolicy.starterLockPlayerIds.filter(
      (lockedId) => lockedId !== playerId,
    );
}

function swapBenchWithRotation(
  selection: TeamSelection,
  benchPlayerId: PlayerId,
  slot: RotationSlot,
): TeamSelection | null {
  const benchIndex = selection.benchPlayerIds.indexOf(benchPlayerId);
  const assignment = selection.rotation.find((item) => item.slot === slot);
  if (benchIndex < 0 || !assignment) return null;

  const outgoingId = assignment.playerId;
  assignment.playerId = benchPlayerId;
  selection.benchPlayerIds[benchIndex] = outgoingId;
  selection.servingOrderPlayerIds = replaceServer(
    selection.servingOrderPlayerIds,
    outgoingId,
    benchPlayerId,
  );
  removeStarterLock(selection, outgoingId);
  return selection;
}

export function repositionTeamSelection({
  selection,
  source,
  target,
}: RepositionTeamSelectionInput): TeamSelection | null {
  if (
    source.type === target.type &&
    ((source.type === "libero" && target.type === "libero") ||
      (source.type === "rotation" &&
        target.type === "rotation" &&
        source.slot === target.slot) ||
      (source.type === "bench" &&
        target.type === "bench" &&
        source.playerId === target.playerId))
  ) {
    return null;
  }

  if (
    (source.type === "rotation" && target.type === "libero") ||
    (source.type === "libero" && target.type === "rotation")
  ) {
    return null;
  }

  const next = cloneSelection(selection);

  if (source.type === "rotation" && target.type === "rotation") {
    const sourceAssignment = next.rotation.find(
      (item) => item.slot === source.slot,
    );
    const targetAssignment = next.rotation.find(
      (item) => item.slot === target.slot,
    );
    if (!sourceAssignment || !targetAssignment) return null;

    const sourceId = sourceAssignment.playerId;
    sourceAssignment.playerId = targetAssignment.playerId;
    targetAssignment.playerId = sourceId;
    return next;
  }

  if (source.type === "bench" && target.type === "rotation") {
    return swapBenchWithRotation(next, source.playerId, target.slot);
  }

  if (source.type === "rotation" && target.type === "bench") {
    const sourceId = rotationPlayer(next, source.slot);
    if (!sourceId) return null;
    return swapBenchWithRotation(next, target.playerId, source.slot);
  }

  if (source.type === "bench" && target.type === "bench") {
    const sourceIndex = next.benchPlayerIds.indexOf(source.playerId);
    const targetIndex = next.benchPlayerIds.indexOf(target.playerId);
    if (sourceIndex < 0 || targetIndex < 0) return null;
    next.benchPlayerIds[sourceIndex] = target.playerId;
    next.benchPlayerIds[targetIndex] = source.playerId;
    return next;
  }

  if (source.type === "bench" && target.type === "libero") {
    if (!next.liberoPlayerId) return null;
    const sourceIndex = next.benchPlayerIds.indexOf(source.playerId);
    if (sourceIndex < 0) return null;
    const outgoingLiberoId = next.liberoPlayerId;
    next.liberoPlayerId = source.playerId;
    next.benchPlayerIds[sourceIndex] = outgoingLiberoId;
    removeStarterLock(next, outgoingLiberoId);
    return next;
  }

  if (source.type === "libero" && target.type === "bench") {
    if (!next.liberoPlayerId) return null;
    const targetIndex = next.benchPlayerIds.indexOf(target.playerId);
    if (targetIndex < 0) return null;
    const outgoingLiberoId = next.liberoPlayerId;
    next.liberoPlayerId = target.playerId;
    next.benchPlayerIds[targetIndex] = outgoingLiberoId;
    removeStarterLock(next, outgoingLiberoId);
    return next;
  }

  return null;
}
