import type { MatchEvent, MatchState } from "../../domain/model/Match";
import type { TeamSelection } from "../../domain/model/TeamSelection";

export type CourtPlay = "serve" | "attack" | "block" | "receive" | "rally";
function playForEvent(event: MatchEvent): CourtPlay {
  if (event.type === "serve") return "serve";
  if (event.type === "attack") return "attack";
  if (event.type === "block") return "block";
  if (event.type === "receive" || event.type === "dig") return "receive";
  return "rally";
}

/**
 * Reveal only the currently visible match segment. No simulation is rerun and
 * no animation state is persisted. The same event always maps to the same
 * court snapshot when the user pauses, skips, or reopens a match.
 */
export function deriveCourtMoment(
  match: MatchState,
  visibleEventIndex: number,
  homeSelection: TeamSelection,
  awaySelection: TeamSelection,
): {
  play: CourtPlay;
  fromHome: boolean;
  actorSlot: number | null;
  actorSide: "home" | "away" | null;
} {
  const current = match.eventLog[visibleEventIndex];
  if (!current) {
    return { play: "rally", fromHome: true, actorSlot: null, actorSide: null };
  }
  let action = current;
  if (current.type === "point") {
    for (let index = visibleEventIndex - 1; index >= 0; index -= 1) {
      const previous = match.eventLog[index];
      if (!previous || previous.setNumber !== current.setNumber) break;
      if (previous.type === "point" || previous.type === "set-end") break;
      if (
        previous.type === "serve" ||
        previous.type === "attack" ||
        previous.type === "block" ||
        previous.type === "receive" ||
        previous.type === "dig"
      ) {
        action = previous;
        break;
      }
    }
  }

  const homeActor = homeSelection.rotation.find(
    (entry) => entry.playerId === action.actorPlayerId,
  );
  const awayActor = awaySelection.rotation.find(
    (entry) => entry.playerId === action.actorPlayerId,
  );
  const actorSide = homeActor ? "home" : awayActor ? "away" : null;
  const fromHome =
    actorSide === "home"
      ? true
      : actorSide === "away"
        ? false
        : (current.winnerSchoolId ?? match.servingSchoolId) ===
          match.homeSchoolId;

  return {
    play: playForEvent(action),
    fromHome,
    actorSide,
    actorSlot: homeActor?.slot ?? awayActor?.slot ?? null,
  };
}
