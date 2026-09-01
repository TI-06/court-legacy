import type { GameState } from "../model/GameState";
import type { PlayerId, SchoolId } from "../model/identifiers";
import type { AutoRestReason } from "./weeklyScheduleTypes";
export type { AutoRestReason } from "./weeklyScheduleTypes";
export interface AutoRestDecision { playerId:PlayerId; reason:AutoRestReason; }
export function selectAutomaticRest(state:GameState,schoolId:SchoolId):AutoRestDecision[]{
  const school=state.schools[schoolId]; if(!school) throw new Error(`unknown school: ${schoolId}`);
  const decisions:AutoRestDecision[]=[];
  for(const playerId of school.playerIds){ const player=state.players[playerId]; if(!player) throw new Error(`school references unknown player: ${playerId}`); if(player.injury) decisions.push({playerId,reason:"injury"}); }
  return decisions;
}
