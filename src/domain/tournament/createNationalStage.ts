import type { GameState } from "../model/GameState";
import { SeededRandom, type RandomSource } from "../random/SeededRandom";
import { buildNationalRepresentativeSchools } from "../world/nationalRepresentativeSchools";
import { calculateTournamentSchoolStrength } from "./createOfficialSeason";
import { tournamentRoundWeek } from "./tournamentSchedule";
import type {
  GuestTournamentEntrant,
  TournamentBracketMatch,
  TournamentCircuit,
  TournamentEntrant,
  TournamentRound,
  TournamentStageState,
  WorldSchoolTournamentEntrant,
} from "./tournamentTypes";

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

function createGuestEntrants(
  state: GameState,
  circuit: TournamentCircuit,
  academicYear: number,
  excludedRegionId: string,
): GuestTournamentEntrant[] {
  const representatives = buildNationalRepresentativeSchools({
    academicYear,
    excludedRegionIds: [excludedRegionId],
  });
  const identityRandom = new SeededRandom(state.seed).fork(
    `tournament:${academicYear}:${circuit}:national:representatives`,
  );
  const selected = shuffle(representatives, identityRandom).slice(0, 15);

  if (selected.length !== 15) {
    throw new Error(
      "national tournament requires at least 15 external representatives",
    );
  }

  return selected.map((representative, slotIndex) => {
    const guestSeed = `${state.seed}::official:${circuit}:${academicYear}:national:representative:${representative.regionId}:${slotIndex}`;
    const strengthRandom = new SeededRandom(guestSeed).fork("strength");
    const seedStrength = Math.round(
      clamp(representative.seedStrength + strengthRandom.int(-3, 3), 45, 115),
    );

    return {
      entrantId: `guest:${circuit}:${academicYear}:${representative.regionId}`,
      source: "guest-representative",
      displayName: representative.displayName,
      shortName: representative.shortName,
      regionLabel: representative.regionLabel,
      guestSeed,
      seedStrength,
    };
  });
}

function createBracketSlots(
  entrants: readonly TournamentEntrant[],
  random: RandomSource,
): TournamentEntrant[] {
  if (entrants.length !== 16) {
    throw new Error("national tournament requires exactly 16 entrants");
  }

  const seeded = [...entrants].sort(
    (left, right) =>
      right.seedStrength - left.seedStrength ||
      left.entrantId.localeCompare(right.entrantId),
  );
  const slots = Array<TournamentEntrant | null>(16).fill(null);

  seeded.slice(0, 4).forEach((entrant, index) => {
    slots[TOP_SEED_MATCH_INDICES[index]! * 2] = entrant;
  });

  const remaining = shuffle(seeded.slice(4), random);
  const openSlots = slots
    .map((entrant, index) => (entrant ? null : index))
    .filter((index): index is number => index !== null);
  openSlots.forEach((slotIndex, index) => {
    slots[slotIndex] = remaining[index]!;
  });

  if (slots.some((entrant) => entrant === null)) {
    throw new Error("failed to fill national tournament bracket");
  }
  return slots as TournamentEntrant[];
}

function createMatches(
  circuit: TournamentCircuit,
  academicYear: number,
  slots: readonly TournamentEntrant[],
): TournamentBracketMatch[] {
  const tournamentId = `official:${circuit}:${academicYear}:national`;
  const matches: TournamentBracketMatch[] = [];

  ROUND_LAYOUT.forEach(({ round, matchCount }, roundIndex) => {
    for (let slotIndex = 0; slotIndex < matchCount; slotIndex += 1) {
      const openingRound = round === "round-of-16";
      matches.push({
        id: `${tournamentId}:${round}:${slotIndex}`,
        round,
        roundIndex,
        slotIndex,
        scheduledWeek: tournamentRoundWeek(circuit, "national", round),
        homeEntrantId: openingRound ? slots[slotIndex * 2]!.entrantId : null,
        awayEntrantId: openingRound
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

export function createNationalStage(input: {
  state: GameState;
  circuit: TournamentCircuit;
  champion: WorldSchoolTournamentEntrant;
}): TournamentStageState {
  const academicYear = input.state.calendar.academicYear;
  const canonicalChampion = input.state.schools[input.champion.schoolId];
  if (!canonicalChampion) {
    throw new Error("national champion must be a persistent world school");
  }

  const champion: WorldSchoolTournamentEntrant = {
    entrantId: input.champion.entrantId,
    source: "world-school",
    schoolId: canonicalChampion.id,
    displayName: canonicalChampion.name,
    shortName: canonicalChampion.shortName,
    seedStrength: calculateTournamentSchoolStrength(
      input.state,
      canonicalChampion,
    ),
  };
  const guests = createGuestEntrants(
    input.state,
    input.circuit,
    academicYear,
    canonicalChampion.regionId,
  );
  const entrants: TournamentEntrant[] = [champion, ...guests];
  const bracketRandom = new SeededRandom(input.state.seed).fork(
    `tournament:${academicYear}:${input.circuit}:national:bracket`,
  );
  const slots = createBracketSlots(entrants, bracketRandom);

  return {
    tournamentId: `official:${input.circuit}:${academicYear}:national`,
    circuit: input.circuit,
    level: "national",
    entrants,
    matches: createMatches(input.circuit, academicYear, slots),
    championEntrantId: null,
    userEliminated: false,
    userBestRound: null,
  };
}
