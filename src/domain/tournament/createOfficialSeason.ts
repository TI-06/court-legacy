import type { GameState } from "../model/GameState";
import { ABILITY_KEYS, type Player } from "../model/Player";
import type { School } from "../model/School";
import { SeededRandom, type RandomSource } from "../random/SeededRandom";
import { tournamentRoundWeek } from "./tournamentSchedule";
import type {
  OfficialCircuitState,
  OfficialSeasonState,
  TournamentBracketMatch,
  TournamentCircuit,
  TournamentRound,
  TournamentStageState,
  WorldSchoolTournamentEntrant,
} from "./tournamentTypes";

type OfficialSeasonSource = Pick<
  GameState,
  "seed" | "calendar" | "schools" | "players" | "userSchoolId" | "randomCursor"
>;

const ROUND_LAYOUT: ReadonlyArray<{
  round: TournamentRound;
  matchCount: number;
}> = [
  { round: "round-of-16", matchCount: 8 },
  { round: "quarterfinal", matchCount: 4 },
  { round: "semifinal", matchCount: 2 },
  { round: "final", matchCount: 1 },
];

const TOP_SEED_MATCH_INDICES = [0, 4, 2, 6] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function playerTournamentStrength(player: Player): number {
  const abilityAverage = average(
    ABILITY_KEYS.map((ability) => player.abilities[ability]),
  );
  const conditionAdjustment = (player.condition - 50) * 0.15;
  const fatiguePenalty = player.fatigue * 0.15;
  const injuryPenalty = player.injury ? 10 : 0;
  return Math.max(
    0,
    abilityAverage + conditionAdjustment - fatiguePenalty - injuryPenalty,
  );
}

export function calculateTournamentSchoolStrength(
  state: OfficialSeasonSource,
  school: School,
): number {
  const playerStrengths = school.playerIds
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => Boolean(player))
    .map(playerTournamentStrength)
    .sort((left, right) => right - left)
    .slice(0, 8);
  const rosterStrength = average(playerStrengths);
  const reputationBonus = clamp(school.reputationPoints / 50, 0, 20);
  const coachBonus =
    school.coach.tactics * 0.08 + school.coach.leadership * 0.04;
  const facilityBonus =
    (school.facilities.gym +
      school.facilities.trainingRoom +
      school.facilities.analysisRoom) *
    0.8;

  return Math.round(
    clamp(rosterStrength + reputationBonus + coachBonus + facilityBonus, 1, 120),
  );
}

function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = random.int(0, index);
    const current = shuffled[index]!;
    shuffled[index] = shuffled[swapIndex]!;
    shuffled[swapIndex] = current;
  }
  return shuffled;
}

function createEntrants(
  state: OfficialSeasonSource,
): WorldSchoolTournamentEntrant[] {
  return Object.values(state.schools)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((school) => ({
      entrantId: `world:${school.id}`,
      source: "world-school" as const,
      schoolId: school.id,
      displayName: school.name,
      shortName: school.shortName,
      seedStrength: calculateTournamentSchoolStrength(state, school),
    }));
}

function createBracketSlots(
  entrants: readonly WorldSchoolTournamentEntrant[],
  random: RandomSource,
): WorldSchoolTournamentEntrant[] {
  if (entrants.length !== 16) {
    throw new Error("prefectural tournament requires exactly 16 schools");
  }

  const seeded = [...entrants].sort(
    (left, right) =>
      right.seedStrength - left.seedStrength ||
      left.entrantId.localeCompare(right.entrantId),
  );
  const slots = Array<WorldSchoolTournamentEntrant | null>(16).fill(null);

  seeded.slice(0, 4).forEach((entrant, index) => {
    const matchIndex = TOP_SEED_MATCH_INDICES[index]!;
    slots[matchIndex * 2] = entrant;
  });

  const remainingEntrants = shuffle(seeded.slice(4), random);
  const remainingSlotIndices = slots
    .map((entrant, index) => (entrant ? null : index))
    .filter((index): index is number => index !== null);

  remainingSlotIndices.forEach((slotIndex, index) => {
    slots[slotIndex] = remainingEntrants[index]!;
  });

  if (slots.some((entrant) => entrant === null)) {
    throw new Error("failed to fill prefectural tournament bracket");
  }

  return slots as WorldSchoolTournamentEntrant[];
}

function createBracketMatches(
  circuit: TournamentCircuit,
  academicYear: number,
  slots: readonly WorldSchoolTournamentEntrant[],
): TournamentBracketMatch[] {
  const tournamentId = `official:${circuit}:${academicYear}:prefectural`;
  const matches: TournamentBracketMatch[] = [];

  ROUND_LAYOUT.forEach(({ round, matchCount }, roundIndex) => {
    for (let slotIndex = 0; slotIndex < matchCount; slotIndex += 1) {
      const isOpeningRound = round === "round-of-16";
      matches.push({
        id: `${tournamentId}:${round}:${slotIndex}`,
        round,
        roundIndex,
        slotIndex,
        scheduledWeek: tournamentRoundWeek(circuit, "prefectural", round),
        homeEntrantId: isOpeningRound
          ? slots[slotIndex * 2]!.entrantId
          : null,
        awayEntrantId: isOpeningRound
          ? slots[slotIndex * 2 + 1]!.entrantId
          : null,
        winnerEntrantId: null,
        homeSetsWon: null,
        awaySetsWon: null,
        status: "waiting",
      });
    }
  });

  return matches;
}

function createPrefecturalStage(
  state: OfficialSeasonSource,
  circuit: TournamentCircuit,
  academicYear: number,
): TournamentStageState {
  const entrants = createEntrants(state);
  const random = new SeededRandom(state.seed).fork(
    `tournament:${academicYear}:${circuit}:prefectural:bracket`,
  );
  const slots = createBracketSlots(entrants, random);

  return {
    tournamentId: `official:${circuit}:${academicYear}:prefectural`,
    circuit,
    level: "prefectural",
    entrants,
    matches: createBracketMatches(circuit, academicYear, slots),
    championEntrantId: null,
    userEliminated: false,
    userBestRound: null,
  };
}

function createCircuit(
  state: OfficialSeasonSource,
  circuit: TournamentCircuit,
  academicYear: number,
): OfficialCircuitState {
  return {
    prefectural: createPrefecturalStage(state, circuit, academicYear),
    national: null,
  };
}

export function createOfficialSeason(input: {
  state: OfficialSeasonSource;
  academicYear?: number;
}): OfficialSeasonState {
  const academicYear = input.academicYear ?? input.state.calendar.academicYear;
  if (!Number.isSafeInteger(academicYear) || academicYear < 1) {
    throw new Error("academic year must be a positive safe integer");
  }

  return {
    academicYear,
    interhigh: createCircuit(input.state, "interhigh", academicYear),
    springHigh: createCircuit(input.state, "spring-high", academicYear),
  };
}
