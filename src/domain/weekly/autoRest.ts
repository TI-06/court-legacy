import type { GameState } from "../model/GameState";
import type { Player } from "../model/Player";
import type { PlayerId, SchoolId } from "../model/identifiers";
import type { AutoRestReason } from "./weeklyScheduleTypes";

export interface AutomaticRestDecision {
  playerId: PlayerId;
  reason: AutoRestReason;
}

export interface AutomaticRestRecovery {
  playerId: PlayerId;
  reason: AutoRestReason;
  fatigueBefore: number;
  fatigueAfter: number;
  conditionBefore: number;
  conditionAfter: number;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function restReasonForPlayer(player: Player): AutoRestReason | null {
  if (player.injury) {
    return "injury";
  }
  if (player.fatigue >= 65) {
    return "fatigue";
  }
  if (player.condition <= 35) {
    return "condition";
  }
  return null;
}

export function selectAutomaticRest(
  state: GameState,
  schoolId: SchoolId,
): AutomaticRestDecision[] {
  const school = state.schools[schoolId];
  if (!school) {
    throw new Error(`unknown school: ${schoolId}`);
  }

  const decisions: AutomaticRestDecision[] = [];
  for (const playerId of school.playerIds) {
    const player = state.players[playerId];
    if (!player) {
      throw new Error(`school references unknown player: ${playerId}`);
    }
    const reason = restReasonForPlayer(player);
    if (reason) {
      decisions.push({ playerId, reason });
    }
  }

  return decisions;
}

export function recoverAutomaticRestPlayer(
  player: Player,
  reason: AutoRestReason,
  recoveryRoomLevel: number,
): { player: Player; recovery: AutomaticRestRecovery } {
  const fatigueRecovery = 12 + Math.max(0, recoveryRoomLevel) * 2;
  const conditionRecovery = reason === "injury" ? 3 : 6;
  const fatigueAfter = clamp(player.fatigue - fatigueRecovery);
  const conditionAfter = clamp(player.condition + conditionRecovery);

  return {
    player: {
      ...player,
      fatigue: fatigueAfter,
      condition: conditionAfter,
    },
    recovery: {
      playerId: player.id,
      reason,
      fatigueBefore: player.fatigue,
      fatigueAfter,
      conditionBefore: player.condition,
      conditionAfter,
    },
  };
}
