import type { GameDataRegistry } from "../../data/dataRegistry";
import { generatePlayer } from "../generation/generatePlayer";
import { generateSchool } from "../generation/generateSchool";
import type { GameState } from "../model/GameState";
import {
  ABILITY_KEYS,
  clampAbility,
  type Grade,
  type Player,
  type Position,
} from "../model/Player";
import type { School, UniformColors } from "../model/School";
import { playerId, schoolId } from "../model/identifiers";
import { SeededRandom, type RandomSource } from "../random/SeededRandom";
import { autoSelectTeam } from "../team/autoSelectTeam";
import type { TeamSelection } from "../model/TeamSelection";
import { calculateTournamentSchoolStrength } from "./createOfficialSeason";
import type { GuestTournamentEntrant } from "./tournamentTypes";

const GUEST_ROSTER_POSITIONS: readonly Position[] = [
  "OH",
  "MB",
  "S",
  "L",
  "OH",
  "MB",
  "OP",
  "S",
  "OH",
  "MB",
  "OP",
  "L",
];

const GUEST_UNIFORMS: readonly UniformColors[] = [
  { primary: "#17365D", secondary: "#FFFFFF", accent: "#D99B2B" },
  { primary: "#7A1F2B", secondary: "#FFFFFF", accent: "#C9A227" },
  { primary: "#154734", secondary: "#FFFFFF", accent: "#D4A017" },
  { primary: "#3B2E5A", secondary: "#F7F7F7", accent: "#D68A1F" },
];

export interface MaterializeGuestOpponentInput {
  state: GameState;
  entrant: GuestTournamentEntrant;
  data: GameDataRegistry;
}

export interface MaterializedGuestOpponent {
  temporaryState: GameState;
  school: School;
  selection: TeamSelection;
}

function createGuestIds(
  state: GameState,
  entrant: GuestTournamentEntrant,
): { school: ReturnType<typeof schoolId>; players: ReturnType<typeof playerId>[] } {
  const guestSchoolId = schoolId(`guest-school:${entrant.entrantId}`);
  const guestPlayerIds = GUEST_ROSTER_POSITIONS.map((_, index) =>
    playerId(`guest-player:${entrant.entrantId}:${index + 1}`),
  );

  if (state.schools[guestSchoolId]) {
    throw new Error(`temporary guest school id collides with persistent state: ${guestSchoolId}`);
  }
  for (const guestPlayerId of guestPlayerIds) {
    if (state.players[guestPlayerId]) {
      throw new Error(
        `temporary guest player id collides with persistent state: ${guestPlayerId}`,
      );
    }
  }

  return { school: guestSchoolId, players: guestPlayerIds };
}

function generateGuestRoster(
  input: MaterializeGuestOpponentInput,
  guestSchoolId: ReturnType<typeof schoolId>,
  guestPlayerIds: readonly ReturnType<typeof playerId>[],
  random: RandomSource,
): Player[] {
  const excludedFullNames = new Set(
    Object.values(input.state.players).map(
      (player) => `${player.lastName} ${player.firstName}`,
    ),
  );

  return GUEST_ROSTER_POSITIONS.map((position, index) => {
    const grade = ((index % 3) + 1) as Grade;
    return generatePlayer({
      id: guestPlayerIds[index]!,
      schoolId: guestSchoolId,
      grade,
      enrolledYear: Math.max(1, input.state.calendar.academicYear - grade + 1),
      tier: "normal",
      data: input.data,
      random,
      preferredPosition: position,
      excludedFullNames,
    });
  });
}

function normalizeGuestSchool(school: School): School {
  return {
    ...school,
    reputation: "prefectural-power",
    reputationPoints: 250,
    coach: {
      ...school.coach,
      tactics: 50,
      leadership: 50,
    },
    facilities: {
      ...school.facilities,
      gym: 2,
      trainingRoom: 2,
      analysisRoom: 1,
    },
  };
}

function stateWithGuestPlayers(
  state: GameState,
  players: readonly Player[],
): GameState {
  const playerRecord = Object.fromEntries(
    players.map((player) => [player.id, player]),
  ) as GameState["players"];
  return {
    ...state,
    players: {
      ...state.players,
      ...playerRecord,
    },
  };
}

function adjustPlayersTowardStrength(
  state: GameState,
  school: School,
  players: readonly Player[],
  requestedStrength: number,
): Player[] {
  const targetStrength = Math.max(45, Math.min(115, requestedStrength));
  let adjusted = players.map((player) => structuredClone(player));

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidateState = stateWithGuestPlayers(state, adjusted);
    const actualStrength = calculateTournamentSchoolStrength(candidateState, school);
    const difference = targetStrength - actualStrength;
    if (Math.abs(difference) <= 1) {
      break;
    }

    adjusted = adjusted.map((player) => ({
      ...player,
      abilities: Object.fromEntries(
        ABILITY_KEYS.map((ability) => [
          ability,
          clampAbility(player.abilities[ability] + difference),
        ]),
      ) as Player["abilities"],
    }));
  }

  return adjusted;
}

function buildTemporaryState(
  state: GameState,
  school: School,
  players: readonly Player[],
): GameState {
  const temporaryState = structuredClone(state);
  temporaryState.schools[school.id] = structuredClone(school);
  for (const player of players) {
    temporaryState.players[player.id] = structuredClone(player);
  }
  return temporaryState;
}

export function materializeGuestOpponent(
  input: MaterializeGuestOpponentInput,
): MaterializedGuestOpponent {
  const ids = createGuestIds(input.state, input.entrant);
  const rosterRandom = new SeededRandom(input.entrant.guestSeed).fork("roster");
  const schoolRandom = new SeededRandom(input.entrant.guestSeed).fork("school");
  const uniformRandom = new SeededRandom(input.entrant.guestSeed).fork("uniform");
  const players = generateGuestRoster(
    input,
    ids.school,
    ids.players,
    rosterRandom,
  );
  let school = generateSchool({
    id: ids.school,
    name: input.entrant.displayName,
    shortName: input.entrant.shortName,
    regionId: `guest:${input.entrant.regionLabel}`,
    coachName: `${input.entrant.shortName} 監督`,
    uniform: uniformRandom.pick(GUEST_UNIFORMS),
    playerIds: players.map((player) => player.id),
    captainPlayerId: players[0]?.id ?? null,
    data: input.data,
    random: schoolRandom,
    isUserSchool: false,
  });
  school = normalizeGuestSchool(school);
  const adjustedPlayers = adjustPlayersTowardStrength(
    input.state,
    school,
    players,
    input.entrant.seedStrength,
  );
  const temporaryState = buildTemporaryState(
    input.state,
    school,
    adjustedPlayers,
  );
  const selection = autoSelectTeam({ state: temporaryState, schoolId: school.id });

  return {
    temporaryState,
    school: temporaryState.schools[school.id]!,
    selection,
  };
}
