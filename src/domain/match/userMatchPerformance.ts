import type { GameState } from "../model/GameState";
import type { MatchState } from "../model/Match";
import type { PlayerId, SchoolId } from "../model/identifiers";
import type { TeamSelection } from "../model/TeamSelection";

export interface UserMatchPlayerPerformance {
  playerId: PlayerId;
  points: number;
  attackPoints: number;
  blockPoints: number;
  serviceAces: number;
  defensePoints: number;
  serveAttempts: number;
  serveErrors: number;
  attackAttempts: number;
  receiveAttempts: number;
  perfectReceives: number;
  idealSets: number;
  successfulDigs: number;
  clutchPoints: number;
  attackSuccessRate: number;
  perfectReceiveRate: number;
}

export interface UserMatchPerformanceSnapshot {
  matchId: MatchState["id"];
  userSchoolId: SchoolId;
  userWon: boolean;
  completedSetCount: number;
  appearanceParticipantIds: readonly PlayerId[];
  experienceParticipantIds: readonly PlayerId[];
  players: ReadonlyMap<PlayerId, UserMatchPlayerPerformance>;
}

function percentage(numerator: number, denominator: number): number {
  return denominator <= 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function userSelection(state: GameState, match: MatchState): TeamSelection {
  if (match.homeSchoolId === state.userSchoolId) {
    return match.homeSelection;
  }
  if (match.awaySchoolId === state.userSchoolId) {
    return match.awaySelection;
  }
  throw new Error("match does not involve the user school");
}

function activePlayerIds(selection: TeamSelection): PlayerId[] {
  const ids = selection.rotation.map((assignment) => assignment.playerId);
  if (selection.liberoPlayerId) {
    ids.push(selection.liberoPlayerId);
  }
  return [...new Set(ids)];
}

function emptyPlayerPerformance(playerId: PlayerId): UserMatchPlayerPerformance {
  return {
    playerId,
    points: 0,
    attackPoints: 0,
    blockPoints: 0,
    serviceAces: 0,
    defensePoints: 0,
    serveAttempts: 0,
    serveErrors: 0,
    attackAttempts: 0,
    receiveAttempts: 0,
    perfectReceives: 0,
    idealSets: 0,
    successfulDigs: 0,
    clutchPoints: 0,
    attackSuccessRate: 0,
    perfectReceiveRate: 0,
  };
}

function isClutchPoint(
  setNumber: number,
  homeScore: number,
  awayScore: number,
): boolean {
  const leadingScore = Math.max(homeScore, awayScore);
  return leadingScore >= 20 || (setNumber >= 3 && leadingScore >= 12);
}

export function buildUserMatchPerformanceSnapshot(
  state: GameState,
  match: MatchState,
): UserMatchPerformanceSnapshot {
  const selection = userSelection(state, match);
  const appearanceParticipantIds = activePlayerIds(selection);
  const roster = new Set<PlayerId>([
    ...selection.rotation.map((assignment) => assignment.playerId),
    ...selection.benchPlayerIds,
  ]);
  if (selection.liberoPlayerId) {
    roster.add(selection.liberoPlayerId);
  }

  const experienceParticipants = new Set<PlayerId>(appearanceParticipantIds);
  const players = new Map<PlayerId, UserMatchPlayerPerformance>();

  const userPlayer = (
    playerId: PlayerId | null,
  ): UserMatchPlayerPerformance | undefined => {
    if (!playerId) return undefined;
    const player = state.players[playerId];
    if (!player || player.career.schoolId !== state.userSchoolId) {
      return undefined;
    }
    let stats = players.get(playerId);
    if (!stats) {
      stats = emptyPlayerPerformance(playerId);
      players.set(playerId, stats);
    }
    return stats;
  };

  for (const event of match.eventLog) {
    if (event.actorPlayerId && roster.has(event.actorPlayerId)) {
      experienceParticipants.add(event.actorPlayerId);
    }
    if (event.targetPlayerId && roster.has(event.targetPlayerId)) {
      experienceParticipants.add(event.targetPlayerId);
    }

    const actor = userPlayer(event.actorPlayerId);
    if (!actor) {
      continue;
    }

    if (event.type === "serve") {
      actor.serveAttempts += 1;
      if (event.detailCode === "serve.error") {
        actor.serveErrors += 1;
      }
    } else if (event.type === "attack") {
      actor.attackAttempts += 1;
    } else if (event.type === "receive") {
      actor.receiveAttempts += 1;
      if (event.detailCode === "receive.perfect") {
        actor.perfectReceives += 1;
      }
    } else if (event.type === "set" && event.detailCode === "set.ideal") {
      actor.idealSets += 1;
    } else if (event.type === "dig" && event.detailCode === "dig.counter") {
      actor.successfulDigs += 1;
    }

    if (
      event.type !== "point" ||
      event.winnerSchoolId !== state.userSchoolId
    ) {
      continue;
    }

    actor.points += 1;
    if (isClutchPoint(event.setNumber, event.homeScore, event.awayScore)) {
      actor.clutchPoints += 1;
    }
    if (event.detailCode === "point.attack") {
      actor.attackPoints += 1;
    } else if (event.detailCode === "point.block") {
      actor.blockPoints += 1;
    } else if (event.detailCode === "point.serve-ace") {
      actor.serviceAces += 1;
    } else if (event.detailCode === "point.defense") {
      actor.defensePoints += 1;
    }
  }

  for (const stats of players.values()) {
    stats.attackSuccessRate = percentage(
      stats.attackPoints,
      stats.attackAttempts,
    );
    stats.perfectReceiveRate = percentage(
      stats.perfectReceives,
      stats.receiveAttempts,
    );
  }

  const userWon =
    match.homeSchoolId === state.userSchoolId
      ? match.homeSetsWon > match.awaySetsWon
      : match.awaySetsWon > match.homeSetsWon;

  return {
    matchId: match.id,
    userSchoolId: state.userSchoolId,
    userWon,
    completedSetCount: match.sets.filter((set) => set.completed).length,
    appearanceParticipantIds,
    experienceParticipantIds: [...experienceParticipants],
    players,
  };
}
