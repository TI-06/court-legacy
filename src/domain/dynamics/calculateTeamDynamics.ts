import { relationshipKey, type GameState } from "../model/GameState";
import type { Player } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { CohesionTrend, TeamDynamicsState } from "./teamDynamicsTypes";

export type TeamDynamicsStateSource = Pick<
  GameState,
  "userSchoolId" | "schools" | "players" | "playerRelationships"
>;

function clamp100(value: number): number {
  if (!Number.isFinite(value)) {
    return 50;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: readonly number[], fallback = 50): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function optionalPlayerMetric(value: number | undefined): number {
  return value ?? 50;
}

function gradeLeadershipBonus(player: Player): number {
  switch (player.grade) {
    case 3:
      return 100;
    case 2:
      return 70;
    case 1:
      return 25;
  }
}

export function calculateLeadershipSuitability(player: Player): number {
  return clamp100(
    optionalPlayerMetric(player.leadership) * 0.4 +
      player.abilities.mental * 0.2 +
      player.trust * 0.15 +
      player.morale * 0.1 +
      optionalPlayerMetric(player.teamAdaptation) * 0.1 +
      gradeLeadershipBonus(player) * 0.05,
  );
}

export function calculateRelationshipSignal(
  state: Pick<GameState, "playerRelationships">,
  rosterIds: readonly PlayerId[],
): number {
  const pairValues: number[] = [];

  for (let leftIndex = 0; leftIndex < rosterIds.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < rosterIds.length;
      rightIndex += 1
    ) {
      const left = rosterIds[leftIndex];
      const right = rosterIds[rightIndex];
      if (!left || !right) {
        continue;
      }
      pairValues.push(
        state.playerRelationships[relationshipKey(left, right)] ?? 50,
      );
    }
  }

  return clamp100(average(pairValues));
}

export function deriveCohesionTrend(
  previous: number,
  current: number,
): CohesionTrend {
  const difference = current - previous;
  if (difference >= 3) {
    return "rising";
  }
  if (difference <= -3) {
    return "falling";
  }
  return "stable";
}

function rosterPlayers(state: TeamDynamicsStateSource): Player[] {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    return [];
  }

  return school.playerIds
    .map((id) => state.players[id])
    .filter((player): player is Player => Boolean(player));
}

function leadershipScoreFor(
  players: readonly Player[],
  playerId: PlayerId | null,
): number {
  if (!playerId) {
    return 0;
  }
  const player = players.find((candidate) => candidate.id === playerId);
  return player ? calculateLeadershipSuitability(player) : 0;
}

export function calculateCohesionTarget(
  state: TeamDynamicsStateSource,
  dynamics: Pick<
    TeamDynamicsState,
    "captainPlayerId" | "viceCaptainPlayerId" | "lineupContinuity"
  >,
): number {
  const players = rosterPlayers(state);
  const rosterIds = players.map((player) => player.id);
  const morale = average(players.map((player) => player.morale));
  const trust = average(players.map((player) => player.trust));
  const relationships = calculateRelationshipSignal(state, rosterIds);
  const captain = leadershipScoreFor(players, dynamics.captainPlayerId);
  const viceCaptain = leadershipScoreFor(players, dynamics.viceCaptainPlayerId);
  const adaptation = average(
    players.map((player) => optionalPlayerMetric(player.teamAdaptation)),
  );
  const lineupContinuity = clamp100(dynamics.lineupContinuity);

  return clamp100(
    morale * 0.25 +
      trust * 0.2 +
      relationships * 0.2 +
      captain * 0.15 +
      viceCaptain * 0.05 +
      adaptation * 0.1 +
      lineupContinuity * 0.05,
  );
}
