import type { GameState } from "../../domain/model/GameState";
import type {
  MatchCommandRecord,
  MatchState,
} from "../../domain/model/Match";

export interface MatchCommandImpactRow {
  sequence: number;
  setNumber: number;
  homeScore: number;
  awayScore: number;
  commandLabel: string;
  observedRallies: number;
  schoolPoints: number;
  opponentPoints: number;
}

function playerDisplayName(state: GameState, playerId: string): string {
  const player = Object.values(state.players).find(
    (candidate) => candidate.id === playerId,
  );
  return player ? `${player.lastName} ${player.firstName}` : "選手";
}

function commandLabel(state: GameState, record: MatchCommandRecord): string {
  switch (record.command.type) {
    case "timeout":
      return "タイムアウト";
    case "set-match-tactics":
      return "戦術変更";
    case "substitute":
      return `${playerDisplayName(state, record.command.outgoingPlayerId)} → ${playerDisplayName(state, record.command.incomingPlayerId)}`;
    case "continue":
      return "このまま続ける";
  }
}

function observedPointSplit(
  match: MatchState,
  record: MatchCommandRecord,
): Pick<
  MatchCommandImpactRow,
  "observedRallies" | "schoolPoints" | "opponentPoints"
> {
  if (
    record.command.type !== "timeout" &&
    record.command.type !== "set-match-tactics"
  ) {
    return { observedRallies: 0, schoolPoints: 0, opponentPoints: 0 };
  }

  const points = match.eventLog
    .filter(
      (event) =>
        event.sequence > record.eventSequence && event.type === "point",
    )
    .slice(0, 5);
  const schoolPoints = points.filter(
    (event) => event.winnerSchoolId === record.schoolId,
  ).length;
  const opponentPoints = points.filter(
    (event) =>
      event.winnerSchoolId !== null &&
      event.winnerSchoolId !== record.schoolId,
  ).length;

  return {
    observedRallies: points.length,
    schoolPoints,
    opponentPoints,
  };
}

export function buildMatchCommandImpactRows(
  state: GameState,
  match: MatchState,
): MatchCommandImpactRow[] {
  if (!match.runtime) {
    return [];
  }

  return match.runtime.commandHistory.map((record) => ({
    sequence: record.sequence,
    setNumber: record.setNumber,
    homeScore: record.homeScore,
    awayScore: record.awayScore,
    commandLabel: commandLabel(state, record),
    ...observedPointSplit(match, record),
  }));
}
