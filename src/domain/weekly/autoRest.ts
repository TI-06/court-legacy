import type { GameState } from "../model/GameState";
import type { Player } from "../model/Player";
import type { PlayerId, SchoolId } from "../model/identifiers";
import type { AutoRestReason } from "./weeklyScheduleTypes";

export type { AutoRestReason } from "./weeklyScheduleTypes";

export interface AutoRestDecision {
  playerId: PlayerId;
  reason: AutoRestReason;
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
): AutoRestDecision[] {
  const school = state.schools[schoolId];
  if (!school) {
    throw new Error(`unknown school: ${schoolId}`);
  }

  const decisions: AutoRestDecision[] = [];
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
