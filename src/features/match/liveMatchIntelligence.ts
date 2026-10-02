import type { GameState } from "../../domain/model/GameState";
import type { MatchState } from "../../domain/model/Match";
import type { PlayerId, SchoolId } from "../../domain/model/identifiers";
import {
  buildMatchStatSummary,
  type PlayerMatchStats,
  type TeamMatchStats,
} from "./matchPresentation";

export type LiveMatchInsightKind =
  | "opponent-run"
  | "hot-attacker"
  | "danger-attacker"
  | "receiver-under-pressure";

export type LiveMatchSuggestedCommand =
  | "timeout"
  | "focus-attacker"
  | "mark-opponent-attacker"
  | "target-serve-receiver";

export interface LiveMatchInsight {
  kind: LiveMatchInsightKind;
  priority: number;
  headline: string;
  detail: string;
  suggestedCommand: LiveMatchSuggestedCommand;
  targetPlayerId: PlayerId | null;
  sampleSize: number;
}

export interface LiveMatchPointFlow {
  sampleSize: number;
  userPoints: number;
  opponentPoints: number;
  trailingOpponentPoints: number;
}

export interface LiveMatchIntelligence {
  visibleEventSequence: number;
  userTeam: TeamMatchStats;
  opponentTeam: TeamMatchStats;
  userPlayers: PlayerMatchStats[];
  opponentPlayers: PlayerMatchStats[];
  pointFlow: LiveMatchPointFlow;
  insights: LiveMatchInsight[];
}

export interface BuildLiveMatchIntelligenceArgs {
  state: GameState;
  match: MatchState;
  userSchoolId: SchoolId;
  visibleEventSequence: number;
}

function comparePlayerSignal(
  first: PlayerMatchStats,
  second: PlayerMatchStats,
): number {
  if (second.attackPoints !== first.attackPoints) {
    return second.attackPoints - first.attackPoints;
  }
  if (second.attackSuccessRate !== first.attackSuccessRate) {
    return second.attackSuccessRate - first.attackSuccessRate;
  }
  if (second.attackAttempts !== first.attackAttempts) {
    return second.attackAttempts - first.attackAttempts;
  }
  return first.playerId.localeCompare(second.playerId);
}

function buildPointFlow(
  match: MatchState,
  userSchoolId: SchoolId,
  visibleEventSequence: number,
): LiveMatchPointFlow {
  const visiblePoints = match.eventLog.filter(
    (event) =>
      event.sequence <= visibleEventSequence &&
      event.type === "point" &&
      event.winnerSchoolId !== null,
  );
  const recentPoints = visiblePoints.slice(-5);
  const userPoints = recentPoints.filter(
    (event) => event.winnerSchoolId === userSchoolId,
  ).length;

  let trailingOpponentPoints = 0;
  for (let index = visiblePoints.length - 1; index >= 0; index -= 1) {
    if (visiblePoints[index]!.winnerSchoolId === userSchoolId) {
      break;
    }
    trailingOpponentPoints += 1;
  }

  return {
    sampleSize: recentPoints.length,
    userPoints,
    opponentPoints: recentPoints.length - userPoints,
    trailingOpponentPoints,
  };
}

function hotAttackerInsight(
  players: readonly PlayerMatchStats[],
): LiveMatchInsight | null {
  const candidate = [...players]
    .filter(
      (player) =>
        player.attackAttempts >= 4 &&
        player.attackPoints >= 3 &&
        player.attackSuccessRate >= 50,
    )
    .sort(comparePlayerSignal)[0];

  if (!candidate) return null;

  return {
    kind: "hot-attacker",
    priority: 70 + Math.min(10, candidate.attackPoints),
    headline: `${candidate.name}が攻撃好調`,
    detail: `アタック ${candidate.attackPoints}/${candidate.attackAttempts}・決定率${candidate.attackSuccessRate}%`,
    suggestedCommand: "focus-attacker",
    targetPlayerId: candidate.playerId,
    sampleSize: candidate.attackAttempts,
  };
}

function dangerAttackerInsight(
  players: readonly PlayerMatchStats[],
): LiveMatchInsight | null {
  const candidate = [...players]
    .filter(
      (player) =>
        player.attackAttempts >= 4 &&
        player.attackPoints >= 3 &&
        player.attackSuccessRate >= 50,
    )
    .sort(comparePlayerSignal)[0];

  if (!candidate) return null;

  return {
    kind: "danger-attacker",
    priority: 90 + Math.min(8, candidate.attackPoints),
    headline: `${candidate.name}のアタックを警戒`,
    detail: `アタック ${candidate.attackPoints}/${candidate.attackAttempts}・決定率${candidate.attackSuccessRate}%`,
    suggestedCommand: "mark-opponent-attacker",
    targetPlayerId: candidate.playerId,
    sampleSize: candidate.attackAttempts,
  };
}

function receiverPressureInsight(
  players: readonly PlayerMatchStats[],
): LiveMatchInsight | null {
  const candidate = [...players]
    .filter(
      (player) =>
        player.receiveAttempts >= 3 && player.perfectReceiveRate <= 35,
    )
    .sort((first, second) => {
      if (first.perfectReceiveRate !== second.perfectReceiveRate) {
        return first.perfectReceiveRate - second.perfectReceiveRate;
      }
      if (second.receiveAttempts !== first.receiveAttempts) {
        return second.receiveAttempts - first.receiveAttempts;
      }
      return first.playerId.localeCompare(second.playerId);
    })[0];

  if (!candidate) return null;

  return {
    kind: "receiver-under-pressure",
    priority: 80 + Math.min(8, candidate.receiveAttempts),
    headline: `${candidate.name}のレシーブを狙える`,
    detail: `好返球 ${candidate.perfectReceives}/${candidate.receiveAttempts}・${candidate.perfectReceiveRate}%`,
    suggestedCommand: "target-serve-receiver",
    targetPlayerId: candidate.playerId,
    sampleSize: candidate.receiveAttempts,
  };
}

export function buildLiveMatchIntelligence({
  state,
  match,
  userSchoolId,
  visibleEventSequence,
}: BuildLiveMatchIntelligenceArgs): LiveMatchIntelligence {
  const summary = buildMatchStatSummary(state, match, visibleEventSequence);
  const userIsHome = match.homeSchoolId === userSchoolId;
  const userTeam = userIsHome ? summary.home : summary.away;
  const opponentTeam = userIsHome ? summary.away : summary.home;
  const userPlayers = summary.players.filter(
    (player) => player.schoolId === userSchoolId,
  );
  const opponentSchoolId = userIsHome
    ? match.awaySchoolId
    : match.homeSchoolId;
  const opponentPlayers = summary.players.filter(
    (player) => player.schoolId === opponentSchoolId,
  );
  const pointFlow = buildPointFlow(match, userSchoolId, visibleEventSequence);

  const insights: LiveMatchInsight[] = [];

  if (pointFlow.trailingOpponentPoints >= 3) {
    insights.push({
      kind: "opponent-run",
      priority: 100 + Math.min(5, pointFlow.trailingOpponentPoints),
      headline: `${pointFlow.trailingOpponentPoints}連続失点`,
      detail: `直近${pointFlow.sampleSize}得点は自校${pointFlow.userPoints} - 相手${pointFlow.opponentPoints}`,
      suggestedCommand: "timeout",
      targetPlayerId: null,
      sampleSize: pointFlow.trailingOpponentPoints,
    });
  }

  const dangerAttacker = dangerAttackerInsight(opponentPlayers);
  if (dangerAttacker) insights.push(dangerAttacker);

  const pressuredReceiver = receiverPressureInsight(opponentPlayers);
  if (pressuredReceiver) insights.push(pressuredReceiver);

  const hotAttacker = hotAttackerInsight(userPlayers);
  if (hotAttacker) insights.push(hotAttacker);

  insights.sort((first, second) => {
    if (second.priority !== first.priority) {
      return second.priority - first.priority;
    }
    const kind = first.kind.localeCompare(second.kind);
    if (kind !== 0) return kind;
    return (first.targetPlayerId ?? "").localeCompare(second.targetPlayerId ?? "");
  });

  return {
    visibleEventSequence,
    userTeam,
    opponentTeam,
    userPlayers,
    opponentPlayers,
    pointFlow,
    insights: insights.slice(0, 3),
  };
}
