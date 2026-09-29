import type { GameState } from "../model/GameState";
import type { Player, Position } from "../model/Player";
import type { PlayerId, SchoolId } from "../model/identifiers";
import type { RotationSlot, TeamSelection } from "../model/TeamSelection";
import { calculatePlayerDisplayPower } from "../selectors/playerPresentation";
import { autoSelectTeam } from "../team/autoSelectTeam";
import { validateTeamSelection } from "../team/validateTeamSelection";

export type PreMatchLineupPreset =
  "best" | "grade-1" | "grade-2" | "grade-3" | "condition";

const ROTATION_ROLES: Record<RotationSlot, Position> = {
  1: "S",
  2: "MB",
  3: "MB",
  4: "OH",
  5: "OH",
  6: "OP",
};

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

function schoolPlayers(state: GameState, schoolId: SchoolId): Player[] {
  const school = state.schools[schoolId];
  if (!school) {
    throw new Error(`unknown school: ${schoolId}`);
  }

  return school.playerIds.map((playerId) => {
    const player = state.players[playerId];
    if (!player) {
      throw new Error(`school references unknown player: ${playerId}`);
    }
    return player;
  });
}

function presetGrade(preset: PreMatchLineupPreset): 1 | 2 | 3 | null {
  if (preset === "grade-1") return 1;
  if (preset === "grade-2") return 2;
  if (preset === "grade-3") return 3;
  return null;
}

function candidateScore(
  player: Player,
  role: Position,
  preset: Exclude<PreMatchLineupPreset, "best">,
): number {
  const grade = presetGrade(preset);
  const gradeBonus = grade !== null && player.grade === grade ? 1_000_000 : 0;
  const conditionBonus = preset === "condition" ? player.condition * 10_000 : 0;
  const aptitude = player.positionAptitudes[role] * 1_000;
  const overall = calculatePlayerDisplayPower(player);

  return gradeBonus + conditionBonus + aptitude + overall;
}

function bestCandidate(
  players: readonly Player[],
  role: Position,
  preset: Exclude<PreMatchLineupPreset, "best">,
): Player {
  const selected = [...players].sort((first, second) => {
    const scoreDifference =
      candidateScore(second, role, preset) -
      candidateScore(first, role, preset);
    if (scoreDifference !== 0) return scoreDifference;
    return first.id.localeCompare(second.id);
  })[0];

  if (!selected) {
    throw new Error(`no eligible player available for role: ${role}`);
  }
  return selected;
}

function validatePresetSelection(
  state: GameState,
  schoolId: SchoolId,
  selection: TeamSelection,
): TeamSelection {
  const issues = validateTeamSelection({ state, schoolId, selection });
  if (issues.length > 0) {
    throw new Error(`invalid pre-match lineup: ${issues[0]!.message}`);
  }
  return selection;
}

export function buildPreMatchLineupPreset(input: {
  state: GameState;
  schoolId: SchoolId;
  baseSelection: TeamSelection;
  preset: PreMatchLineupPreset;
}): TeamSelection {
  const preset = input.preset;
  if (preset === "best") {
    return autoSelectTeam({ state: input.state, schoolId: input.schoolId });
  }

  const players = schoolPlayers(input.state, input.schoolId);
  const eligible = players.filter((player) => !player.injury);
  if (eligible.length < 7) {
    throw new Error("team selection requires at least seven eligible players");
  }

  const available = new Map(eligible.map((player) => [player.id, player]));
  const rotation = ([1, 2, 3, 4, 5, 6] as const).map((slot) => {
    const selected = bestCandidate(
      [...available.values()],
      ROTATION_ROLES[slot],
      preset,
    );
    available.delete(selected.id);
    return { slot, playerId: selected.id };
  });
  const libero = bestCandidate([...available.values()], "L", preset);

  const activeIds = new Set(rotation.map((assignment) => assignment.playerId));
  activeIds.add(libero.id);
  const selection: TeamSelection = {
    rotation,
    liberoPlayerId: libero.id,
    benchPlayerIds: players
      .map((player) => player.id)
      .filter((playerId) => !activeIds.has(playerId)),
    servingOrderPlayerIds: rotation.map((assignment) => assignment.playerId),
    substitutionPolicy: {
      ...input.baseSelection.substitutionPolicy,
      starterLockPlayerIds: [],
    },
  };

  return validatePresetSelection(input.state, input.schoolId, selection);
}

export function prioritizePlayerForPreMatch(input: {
  state: GameState;
  schoolId: SchoolId;
  selection: TeamSelection;
  playerId: PlayerId;
}): TeamSelection {
  const player = input.state.players[input.playerId];
  if (!player || player.career.schoolId !== input.schoolId) {
    throw new Error("priority player is not available for this school");
  }
  if (player.injury) {
    throw new Error("injured player cannot be prioritized");
  }

  const activePlayerIds = new Set([
    ...input.selection.rotation.map((assignment) => assignment.playerId),
    ...(input.selection.liberoPlayerId
      ? [input.selection.liberoPlayerId]
      : []),
  ]);
  if (activePlayerIds.has(player.id)) {
    return cloneSelection(input.selection);
  }
  if (!input.selection.benchPlayerIds.includes(player.id)) {
    throw new Error("priority player must be on the bench");
  }

  if (player.preferredPosition === "L" && input.selection.liberoPlayerId) {
    return validatePresetSelection(
      input.state,
      input.schoolId,
      replacePreMatchPlayer({
        selection: input.selection,
        outgoingPlayerId: input.selection.liberoPlayerId,
        incomingPlayerId: player.id,
      }),
    );
  }

  const preferredSlots = input.selection.rotation.filter(
    (assignment) => ROTATION_ROLES[assignment.slot] === player.preferredPosition,
  );
  const candidates =
    preferredSlots.length > 0
      ? preferredSlots
      : input.selection.rotation.filter(
          (assignment) => ROTATION_ROLES[assignment.slot] !== "L",
        );

  const outgoing = [...candidates].sort((left, right) => {
    const leftPlayer = input.state.players[left.playerId];
    const rightPlayer = input.state.players[right.playerId];
    const leftScore = leftPlayer
      ? leftPlayer.positionAptitudes[ROTATION_ROLES[left.slot]] * 1_000 +
        calculatePlayerDisplayPower(leftPlayer)
      : Number.NEGATIVE_INFINITY;
    const rightScore = rightPlayer
      ? rightPlayer.positionAptitudes[ROTATION_ROLES[right.slot]] * 1_000 +
        calculatePlayerDisplayPower(rightPlayer)
      : Number.NEGATIVE_INFINITY;
    return leftScore - rightScore || left.slot - right.slot;
  })[0];

  if (!outgoing) {
    throw new Error("no rotation player available for priority selection");
  }

  return validatePresetSelection(
    input.state,
    input.schoolId,
    replacePreMatchPlayer({
      selection: input.selection,
      outgoingPlayerId: outgoing.playerId,
      incomingPlayerId: player.id,
    }),
  );
}

export function replacePreMatchPlayer(input: {
  selection: TeamSelection;
  outgoingPlayerId: PlayerId;
  incomingPlayerId: PlayerId;
}): TeamSelection {
  if (input.outgoingPlayerId === input.incomingPlayerId) {
    return cloneSelection(input.selection);
  }
  if (!input.selection.benchPlayerIds.includes(input.incomingPlayerId)) {
    throw new Error("incoming pre-match player must be on the bench");
  }

  const selection = cloneSelection(input.selection);
  const rotationAssignment = selection.rotation.find(
    (assignment) => assignment.playerId === input.outgoingPlayerId,
  );

  if (rotationAssignment) {
    rotationAssignment.playerId = input.incomingPlayerId;
    selection.servingOrderPlayerIds = selection.servingOrderPlayerIds.map(
      (playerId) =>
        playerId === input.outgoingPlayerId ? input.incomingPlayerId : playerId,
    );
  } else if (selection.liberoPlayerId === input.outgoingPlayerId) {
    selection.liberoPlayerId = input.incomingPlayerId;
  } else {
    throw new Error("outgoing pre-match player is not active");
  }

  selection.benchPlayerIds = selection.benchPlayerIds
    .filter((playerId) => playerId !== input.incomingPlayerId)
    .concat(input.outgoingPlayerId);
  selection.substitutionPolicy.starterLockPlayerIds =
    selection.substitutionPolicy.starterLockPlayerIds.filter(
      (playerId) => playerId !== input.outgoingPlayerId,
    );

  return selection;
}
