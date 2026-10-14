import type { MatchEvent, MatchState } from "../../domain/model/Match";

export type PointCelebrationKind =
  | "ace"
  | "block"
  | "spike"
  | "defense"
  | "point";

interface PointCelebration {
  kind: PointCelebrationKind;
  label: string;
  fromHome: boolean;
}

export function pointCelebrationForEvent(
  event: MatchEvent,
  match: MatchState,
): PointCelebration | null {
  if (event.type !== "point" || !event.winnerSchoolId) return null;

  const kind: PointCelebrationKind =
    event.detailCode === "point.serve-ace"
      ? "ace"
      : event.detailCode === "point.block"
        ? "block"
        : event.detailCode === "point.attack"
          ? "spike"
          : event.detailCode === "point.defense"
            ? "defense"
            : "point";
  const label: Record<PointCelebrationKind, string> = {
    ace: "SERVICE ACE!",
    block: "NICE BLOCK!",
    spike: "SPIKE!",
    defense: "NICE DIG!",
    point: "POINT!",
  };
  return {
    kind,
    label: label[kind],
    fromHome: event.winnerSchoolId === match.homeSchoolId,
  };
}
