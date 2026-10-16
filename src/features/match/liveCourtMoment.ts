import type { MatchEvent, MatchState } from "../../domain/model/Match";
import type { TeamSelection } from "../../domain/model/TeamSelection";

export type CourtPlay = "serve" | "receive" | "set" | "attack" | "block" | "rally";
function playForEvent(event: MatchEvent): CourtPlay {
  if (event.type === "serve") return "serve";
  if (event.type === "set") return "set";
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
        previous.type === "set" ||
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

/** Read only already-revealed events. A point includes up to four actual rally actions. */
export function deriveCourtRally(
  match: MatchState,
  visibleEventIndex: number,
  homeSelection: TeamSelection,
  awaySelection: TeamSelection,
) {
  const current = match.eventLog[visibleEventIndex];
  if (!current) return [];
  const indices: number[] = [];
  if (current.type !== "point") {
    if (playForEvent(current) !== "rally") indices.push(visibleEventIndex);
  } else {
    for (
      let index = visibleEventIndex - 1, checked = 0;
      index >= 0 && checked < 24 && indices.length < 4;
      index -= 1, checked += 1
    ) {
      const previous = match.eventLog[index];
      if (
        !previous ||
        previous.setNumber !== current.setNumber ||
        previous.type === "point" ||
        previous.type === "set-end" ||
        previous.type === "match-end"
      ) break;
      if (playForEvent(previous) !== "rally") indices.unshift(index);
    }
  }
  return indices.map((index) => ({
    sequence: match.eventLog[index]!.sequence,
    ...deriveCourtMoment(match, index, homeSelection, awaySelection),
  }));
}

export interface CourtTrajectory {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  path: string;
}

/**
 * Deliberately different physical ball motions:
 * receive/set/block remain on one side, while serve/attack cross the net.
 * Routes depend on the logged action only; they never modify the match.
 */
export function courtTrajectory(
  play: CourtPlay,
  fromHome: boolean,
): CourtTrajectory | null {
  type Geometry = {
    start: [number, number];
    end: [number, number];
    arc: number;
  };
  const geometry: Partial<Record<CourtPlay, Geometry>> = {
    serve: { start: [72, 88], end: [244, 103], arc: 18 },
    receive: { start: [89, 107], end: [146, 80], arc: 60 },
    set: { start: [136, 94], end: [158, 57], arc: 20 },
    attack: { start: [152, 57], end: [250, 112], arc: 23 },
    block: { start: [169, 58], end: [160, 98], arc: 27 },
  };
  const route = geometry[play];
  if (!route) return null;
  const mirror = (x: number) => (fromHome ? x : 360 - x);
  const startX = mirror(route.start[0]);
  const endX = mirror(route.end[0]);
  const startY = route.start[1];
  const endY = route.end[1];
  const controlX = (startX + endX) / 2;
  return {
    startX,
    startY,
    endX,
    endY,
    path: `M ${startX} ${startY} Q ${controlX} ${route.arc} ${endX} ${endY}`,
  };
}
