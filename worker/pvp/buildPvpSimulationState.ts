import type { GameState } from "../../src/domain/model/GameState";
import type { Player } from "../../src/domain/model/Player";
import type { School } from "../../src/domain/model/School";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import {
  playerId,
  schoolId,
  type PlayerId,
  type SchoolId,
} from "../../src/domain/model/identifiers";
import type { PublishedPvpTeamSnapshot } from "../data/PvPStore";

export interface BuildPvpSimulationStateInput {
  challenger: {
    userId: string;
    state: GameState;
    teamSelection: TeamSelection;
  };
  defender: PublishedPvpTeamSnapshot;
}

export interface PvpSimulationState {
  state: GameState;
  challengerSchoolId: SchoolId;
  defenderSchoolId: SchoolId;
  challengerSelection: TeamSelection;
  defenderSelection: TeamSelection;
}

type PlayerIdMap = Map<string, PlayerId>;

function mapPlayerId(
  map: PlayerIdMap,
  originalId: PlayerId,
  label: string,
): PlayerId {
  const mapped = map.get(originalId);
  if (!mapped) {
    throw new Error(
      `${label} references a player outside its PvP roster: ${originalId}`,
    );
  }
  return mapped;
}

function remapSelection(
  selection: TeamSelection,
  ownPlayers: PlayerIdMap,
): TeamSelection {
  return {
    rotation: selection.rotation.map((assignment) => ({
      ...assignment,
      playerId: mapPlayerId(ownPlayers, assignment.playerId, "rotation"),
    })),
    liberoPlayerId: selection.liberoPlayerId
      ? mapPlayerId(ownPlayers, selection.liberoPlayerId, "libero")
      : null,
    benchPlayerIds: selection.benchPlayerIds.map((id) =>
      mapPlayerId(ownPlayers, id, "bench"),
    ),
    servingOrderPlayerIds: selection.servingOrderPlayerIds.map((id) =>
      mapPlayerId(ownPlayers, id, "serving order"),
    ),
    substitutionPolicy: {
      ...selection.substitutionPolicy,
      starterLockPlayerIds:
        selection.substitutionPolicy.starterLockPlayerIds.map((id) =>
          mapPlayerId(ownPlayers, id, "starter lock"),
        ),
    },
  };
}

function remapPlayers(
  players: readonly Player[],
  idMap: PlayerIdMap,
  school: SchoolId,
): Record<PlayerId, Player> {
  return Object.fromEntries(
    players.map((source) => {
      const id = mapPlayerId(idMap, source.id, "player");
      const player: Player = {
        ...structuredClone(source),
        id,
        condition: 100,
        fatigue: 0,
        injury: null,
        career: {
          ...structuredClone(source.career),
          schoolId: school,
        },
      };
      return [id, player];
    }),
  ) as Record<PlayerId, Player>;
}

function remapSchool(
  source: School,
  school: SchoolId,
  ownPlayers: PlayerIdMap,
  opponentPlayers: PlayerIdMap,
): School {
  const target = source.tactics.serveTargetPlayerId
    ? (opponentPlayers.get(source.tactics.serveTargetPlayerId) ?? null)
    : null;

  return {
    ...structuredClone(source),
    id: school,
    playerIds: source.playerIds.map((id) =>
      mapPlayerId(ownPlayers, id, "school roster"),
    ),
    alumniPlayerIds: [],
    captainPlayerId: source.captainPlayerId
      ? (ownPlayers.get(source.captainPlayerId) ?? null)
      : null,
    tactics: {
      ...structuredClone(source.tactics),
      serveTargetPlayerId: target,
    },
  };
}

function createPlayerIdMap(
  ids: readonly PlayerId[],
  namespace: string,
): PlayerIdMap {
  return new Map(ids.map((id) => [id, playerId(`${namespace}:${id}`)]));
}

export function buildPvpSimulationState(
  input: BuildPvpSimulationStateInput,
): PvpSimulationState {
  const challengerSourceSchool =
    input.challenger.state.schools[input.challenger.state.userSchoolId];
  if (!challengerSourceSchool) {
    throw new Error("challenger school is missing from authoritative state");
  }

  const defenderSourceSchool = input.defender.school;
  const challengerSchoolId = schoolId(
    `challenger:${input.challenger.userId}:${challengerSourceSchool.id}`,
  );
  const defenderSchoolId = schoolId(
    `defender:${input.defender.id}:${defenderSourceSchool.id}`,
  );
  const challengerPlayerMap = createPlayerIdMap(
    challengerSourceSchool.playerIds,
    `challenger:${input.challenger.userId}`,
  );
  const defenderPlayerMap = createPlayerIdMap(
    defenderSourceSchool.playerIds,
    `defender:${input.defender.id}`,
  );

  const challengerPlayers = challengerSourceSchool.playerIds.map((id) => {
    const player = input.challenger.state.players[id];
    if (!player) {
      throw new Error(`challenger roster references unknown player: ${id}`);
    }
    return player;
  });
  const defenderPlayers = defenderSourceSchool.playerIds.map((id) => {
    const player = input.defender.players[id];
    if (!player) {
      throw new Error(`defender snapshot references unknown player: ${id}`);
    }
    return player;
  });

  const challengerSchool = remapSchool(
    challengerSourceSchool,
    challengerSchoolId,
    challengerPlayerMap,
    defenderPlayerMap,
  );
  const defenderSchool = remapSchool(
    defenderSourceSchool,
    defenderSchoolId,
    defenderPlayerMap,
    challengerPlayerMap,
  );
  const state = structuredClone(input.challenger.state);
  state.userSchoolId = challengerSchoolId;
  state.schools = {
    [challengerSchoolId]: challengerSchool,
    [defenderSchoolId]: defenderSchool,
  } as Record<SchoolId, School>;
  state.players = {
    ...remapPlayers(challengerPlayers, challengerPlayerMap, challengerSchoolId),
    ...remapPlayers(defenderPlayers, defenderPlayerMap, defenderSchoolId),
  } as Record<PlayerId, Player>;
  state.playerRelationships = {};
  state.activeMatch = null;
  state.pendingEvent = null;
  state.recruiting = undefined;
  state.shopEffects = undefined;

  return {
    state,
    challengerSchoolId,
    defenderSchoolId,
    challengerSelection: remapSelection(
      input.challenger.teamSelection,
      challengerPlayerMap,
    ),
    defenderSelection: remapSelection(
      input.defender.teamSelection,
      defenderPlayerMap,
    ),
  };
}
