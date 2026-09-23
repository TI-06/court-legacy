import type { GameState } from "../../domain/model/GameState";
import type { MatchCommandRecord, MatchState } from "../../domain/model/Match";
import type { SchoolId } from "../../domain/model/identifiers";

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

export interface MatchLiveCoachEffectRow {
  sequence: number;
  kind: "timeout" | "focus-attacker" | "encourage-player";
  label: string;
  ralliesRemaining: number;
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
    case "focus-attacker":
      return `${playerDisplayName(state, record.command.playerId)}に攻撃集中`;
    case "encourage-player":
      return `${playerDisplayName(state, record.command.playerId)}に声かけ`;
    case "substitute":
      return `${playerDisplayName(state, record.command.outgoingPlayerId)} → ${playerDisplayName(state, record.command.incomingPlayerId)}`;
    case "continue":
      return "このまま続ける";
    case "skip-to-result":
      return "結果までスキップ";
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
    record.command.type !== "set-match-tactics" &&
    record.command.type !== "focus-attacker" &&
    record.command.type !== "encourage-player"
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
      event.winnerSchoolId !== null && event.winnerSchoolId !== record.schoolId,
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


function temporaryEffectLabel(
  state: GameState,
  record: MatchCommandRecord,
): MatchLiveCoachEffectRow["label"] | null {
  switch (record.command.type) {
    case "timeout":
      return "タイムアウト効果";
    case "focus-attacker":
      return `${playerDisplayName(state, record.command.playerId)}に攻撃集中`;
    case "encourage-player":
      return `${playerDisplayName(state, record.command.playerId)}に声かけ`;
    default:
      return null;
  }
}

export function buildLiveCoachEffectRows(
  state: GameState,
  match: MatchState,
  schoolId: SchoolId,
  visibleEventSequence: number,
): MatchLiveCoachEffectRow[] {
  if (!match.runtime || visibleEventSequence < 1) {
    return [];
  }

  const visibleEvent = [...match.eventLog]
    .reverse()
    .find((event) => event.sequence <= visibleEventSequence);
  if (!visibleEvent) {
    return [];
  }

  const seenKinds = new Set<MatchLiveCoachEffectRow["kind"]>();
  const rows: MatchLiveCoachEffectRow[] = [];

  for (const record of [...match.runtime.commandHistory].reverse()) {
    if (
      record.schoolId !== schoolId ||
      record.eventSequence > visibleEventSequence
    ) {
      continue;
    }

    const label = temporaryEffectLabel(state, record);
    if (!label) {
      continue;
    }

    const kind = record.command.type as MatchLiveCoachEffectRow["kind"];
    if (seenKinds.has(kind) || record.setNumber !== visibleEvent.setNumber) {
      continue;
    }

    const setEnded = match.eventLog.some(
      (event) =>
        event.sequence > record.eventSequence &&
        event.sequence <= visibleEventSequence &&
        event.type === "set-end" &&
        event.setNumber === record.setNumber,
    );
    if (setEnded) {
      continue;
    }

    const observedRallies = match.eventLog.filter(
      (event) =>
        event.sequence > record.eventSequence &&
        event.sequence <= visibleEventSequence &&
        event.type === "point" &&
        event.setNumber === record.setNumber,
    ).length;
    const ralliesRemaining = Math.max(0, 5 - observedRallies);
    if (ralliesRemaining === 0) {
      continue;
    }

    seenKinds.add(kind);
    rows.push({
      sequence: record.sequence,
      kind,
      label,
      ralliesRemaining,
    });
  }

  return rows.sort((first, second) => first.sequence - second.sequence);
}
