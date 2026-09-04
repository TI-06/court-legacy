import type { GameState } from "../model/GameState";
import type { Player, Position } from "../model/Player";
import type { PlayerId, SchoolId } from "../model/identifiers";
import type {
  RotationAssignment,
  RotationSlot,
  TeamSelection,
} from "../model/TeamSelection";
import { validateTeamSelection } from "./validateTeamSelection";

const ROTATION_ROLES: readonly Position[] = ["S", "MB", "MB", "OH", "OH", "OP"];

export interface AutoSelectTeamInput {
  state: GameState;
  schoolId: SchoolId;
}

export type StarterReplacementReason = "injury" | "fatigue";

export interface StarterReplacement {
  playerId: PlayerId;
  replacementPlayerId: PlayerId;
  reason: StarterReplacementReason;
}

export interface ResolveLockedStartersInput {
  state: GameState;
  schoolId: SchoolId;
  selection: TeamSelection;
}

export interface LockedStarterResolution {
  selection: TeamSelection;
  replacements: StarterReplacement[];
}

function roleScore(player: Player, role: Position): number {
  const aptitude = player.positionAptitudes[role] * 3;
  const readiness = player.condition * 1.2;
  const common = player.abilities.mental + player.abilities.decision;

  switch (role) {
    case "S":
      return (
        aptitude +
        player.abilities.set * 3 +
        player.abilities.receive +
        player.abilities.speed +
        common +
        readiness
      );
    case "MB":
      return (
        aptitude +
        player.abilities.block * 3 +
        player.abilities.jump * 2 +
        player.abilities.speed +
        player.abilities.spike +
        common +
        readiness
      );
    case "OH":
      return (
        aptitude +
        player.abilities.spike * 3 +
        player.abilities.receive * 2 +
        player.abilities.jump +
        player.abilities.serve +
        common +
        readiness
      );
    case "OP":
      return (
        aptitude +
        player.abilities.spike * 3 +
        player.abilities.serve * 2 +
        player.abilities.jump +
        player.abilities.block +
        common +
        readiness
      );
    case "L":
      return (
        aptitude +
        player.abilities.receive * 3 +
        player.abilities.speed * 2 +
        player.abilities.decision * 2 +
        player.abilities.mental +
        readiness
      );
  }
}

function stableBest(players: readonly Player[], role: Position): Player {
  const sorted = [...players].sort((first, second) => {
    const scoreDifference = roleScore(second, role) - roleScore(first, role);
    return scoreDifference !== 0
      ? scoreDifference
      : first.id.localeCompare(second.id);
  });
  const selected = sorted[0];

  if (!selected) {
    throw new Error(`no eligible player available for role: ${role}`);
  }
  return selected;
}

function isNormallyEligible(player: Player): boolean {
  return !player.injury;
}

function schoolPlayers(state: GameState, schoolId: SchoolId): Player[] {
  const school = state.schools[schoolId];
  if (!school) {
    throw new Error(`unknown selection school: ${schoolId}`);
  }

  return school.playerIds.map((playerId) => {
    const player = state.players[playerId];
    if (!player) {
      throw new Error(`school references unknown player: ${playerId}`);
    }
    return player;
  });
}

export function autoSelectTeam(input: AutoSelectTeamInput): TeamSelection {
  const players = schoolPlayers(input.state, input.schoolId);
  const eligible = players.filter(isNormallyEligible);
  if (eligible.length < 7) {
    throw new Error("team selection requires at least seven eligible players");
  }

  const available = new Map(eligible.map((player) => [player.id, player]));
  const rotation: RotationAssignment[] = ROTATION_ROLES.map((role, index) => {
    const selected = stableBest([...available.values()], role);
    available.delete(selected.id);

    return {
      slot: (index + 1) as RotationSlot,
      playerId: selected.id,
    };
  });
  const libero = stableBest([...available.values()], "L");
  available.delete(libero.id);
  const activeIds = new Set(rotation.map((assignment) => assignment.playerId));
  activeIds.add(libero.id);
  const benchPlayerIds = players
    .map((player) => player.id)
    .filter((playerId) => !activeIds.has(playerId));
  const selection: TeamSelection = {
    rotation,
    liberoPlayerId: libero.id,
    benchPlayerIds,
    servingOrderPlayerIds: rotation.map((assignment) => assignment.playerId),
    substitutionPolicy: {
      starterLockPlayerIds: [],
      allowFatigueBenching: false,
      allowInjuryBenching: true,
      automaticSubstitutions: true,
      automaticSetChanges: false,
    },
  };
  const issues = validateTeamSelection({
    state: input.state,
    schoolId: input.schoolId,
    selection,
  });
  if (issues.length > 0) {
    throw new Error(
      `automatic team selection is invalid: ${issues[0]!.message}`,
    );
  }

  return selection;
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

function swapRotationPlayer(
  selection: TeamSelection,
  outgoingPlayerId: PlayerId,
  incomingPlayerId: PlayerId,
): void {
  const assignment = selection.rotation.find(
    (item) => item.playerId === outgoingPlayerId,
  );
  if (!assignment) {
    throw new Error(`rotation player not found: ${outgoingPlayerId}`);
  }
  assignment.playerId = incomingPlayerId;

  selection.servingOrderPlayerIds = selection.servingOrderPlayerIds.map(
    (playerId) => (playerId === outgoingPlayerId ? incomingPlayerId : playerId),
  );
  selection.benchPlayerIds = selection.benchPlayerIds
    .filter((playerId) => playerId !== incomingPlayerId)
    .concat(outgoingPlayerId);
}

function swapLiberoPlayer(
  selection: TeamSelection,
  outgoingPlayerId: PlayerId,
  incomingPlayerId: PlayerId,
): void {
  if (selection.liberoPlayerId !== outgoingPlayerId) {
    throw new Error(`libero player not found: ${outgoingPlayerId}`);
  }

  selection.liberoPlayerId = incomingPlayerId;
  selection.benchPlayerIds = selection.benchPlayerIds
    .filter((playerId) => playerId !== incomingPlayerId)
    .concat(outgoingPlayerId);
}

function eligibleReplacementCandidates(
  state: GameState,
  selection: TeamSelection,
  lockedIds: ReadonlySet<PlayerId>,
): Player[] {
  return selection.benchPlayerIds
    .filter((playerId) => !lockedIds.has(playerId))
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => Boolean(player))
    .filter(isNormallyEligible);
}

function promoteEligibleLockedPlayers(
  state: GameState,
  selection: TeamSelection,
): void {
  const lockedIds = new Set(selection.substitutionPolicy.starterLockPlayerIds);

  for (const lockedId of lockedIds) {
    const player = state.players[lockedId];
    if (!player) {
      continue;
    }
    const alreadyActive =
      selection.rotation.some((item) => item.playerId === lockedId) ||
      selection.liberoPlayerId === lockedId;
    if (alreadyActive || !selection.benchPlayerIds.includes(lockedId)) {
      continue;
    }
    if (!isNormallyEligible(player)) {
      continue;
    }

    const replaceable = selection.rotation
      .map((assignment) => ({
        assignment,
        player: state.players[assignment.playerId],
      }))
      .filter(
        (
          candidate,
        ): candidate is {
          assignment: RotationAssignment;
          player: Player;
        } => Boolean(candidate.player) && !lockedIds.has(candidate.player.id),
      )
      .sort((first, second) => {
        const firstMatches =
          first.player.preferredPosition === player.preferredPosition ? 1 : 0;
        const secondMatches =
          second.player.preferredPosition === player.preferredPosition ? 1 : 0;
        if (firstMatches !== secondMatches) {
          return secondMatches - firstMatches;
        }
        const scoreDifference =
          roleScore(first.player, player.preferredPosition) -
          roleScore(second.player, player.preferredPosition);
        return scoreDifference !== 0
          ? scoreDifference
          : first.player.id.localeCompare(second.player.id);
      });
    const outgoing = replaceable[0]?.player;
    if (outgoing) {
      swapRotationPlayer(selection, outgoing.id, player.id);
    }
  }
}

function safetyReason(
  player: Player,
  selection: TeamSelection,
): StarterReplacementReason | null {
  if (player.injury && selection.substitutionPolicy.allowInjuryBenching) {
    return "injury";
  }
  return null;
}

export function resolveLockedStarters(
  input: ResolveLockedStartersInput,
): LockedStarterResolution {
  const initialIssues = validateTeamSelection(input);
  if (initialIssues.length > 0) {
    throw new Error(`invalid team selection: ${initialIssues[0]!.message}`);
  }

  const selection = cloneSelection(input.selection);
  const replacements: StarterReplacement[] = [];
  promoteEligibleLockedPlayers(input.state, selection);
  const lockedIds = new Set(selection.substitutionPolicy.starterLockPlayerIds);

  for (const lockedId of lockedIds) {
    const isRotationPlayer = selection.rotation.some(
      (item) => item.playerId === lockedId,
    );
    const isLibero = selection.liberoPlayerId === lockedId;
    if (!isRotationPlayer && !isLibero) {
      continue;
    }
    const player = input.state.players[lockedId];
    if (!player) {
      continue;
    }
    const reason = safetyReason(player, selection);
    if (!reason) {
      continue;
    }

    const candidates = eligibleReplacementCandidates(
      input.state,
      selection,
      lockedIds,
    );
    if (candidates.length === 0) {
      continue;
    }
    const replacement = stableBest(
      candidates,
      isLibero ? "L" : player.preferredPosition,
    );
    if (isLibero) {
      swapLiberoPlayer(selection, lockedId, replacement.id);
    } else {
      swapRotationPlayer(selection, lockedId, replacement.id);
    }
    replacements.push({
      playerId: lockedId,
      replacementPlayerId: replacement.id,
      reason,
    });
  }

  const finalIssues = validateTeamSelection({
    state: input.state,
    schoolId: input.schoolId,
    selection,
  });
  if (finalIssues.length > 0) {
    throw new Error(
      `resolved team selection is invalid: ${finalIssues[0]!.message}`,
    );
  }

  return { selection, replacements };
}
