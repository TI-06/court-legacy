import type { GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";

function playerName(state: GameState, id: PlayerId | undefined): string {
  const player = id ? state.players[id] : undefined;
  return player ? `${player.lastName} ${player.firstName}` : "選手";
}

export function renderEventText(
  template: string,
  state: GameState,
  actorPlayerIds: readonly PlayerId[],
): string {
  const school = state.schools[state.userSchoolId];
  return template
    .replaceAll("{{player}}", playerName(state, actorPlayerIds[0]))
    .replaceAll("{{player2}}", playerName(state, actorPlayerIds[1]))
    .replaceAll("{{player3}}", playerName(state, actorPlayerIds[2]))
    .replaceAll("{{school}}", school?.name ?? "自校");
}
