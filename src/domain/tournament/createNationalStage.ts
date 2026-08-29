import type { GameState } from "../model/GameState";
import { SeededRandom, type RandomSource } from "../random/SeededRandom";
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

const GUEST_SCHOOL_NAMES = [
  "北嶺学園",
  "蒼天高校",
  "白鷺学院",
  "東雲工業",
  "龍峰高校",
  "碧海学園",
  "星陵学院",
  "常盤高校",
  "紫苑学園",
  "鳳翔高校",
  "暁星工業",
  "銀河学院",
  "瑞雲高校",
  "天翔学園",
  "玄武高校",
  "青嵐学院",
  "白虎工業",
  "飛鳥高校",
  "海星学園",
  "緋桜学院",
  "朝凪高校",
  "神峰学園",
  "大樹工業",
  "光陵高校",
  "金剛学院",
  "翠嶺高校",
  "夕凪学園",
  "旭峰工業",
  "清流学院",
  "雷鳴高校",
] as const;

const GUEST_REGION_LABELS = [
  "北海地区",
  "北東地区",
  "東北地区",
  "北関東地区",
  "東関東地区",
  "南関東地区",
  "甲信地区",
  "北陸地区",
  "東海地区",
  "近畿北地区",
  "近畿南地区",
  "中国地区",
  "四国地区",
  "北九州地区",
  "南九州地区",
] as const;

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
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
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
): GuestTournamentEntrant[] {
  const strengthAverage = average(
    Object.values(state.schools).map((school) =>
      calculateTournamentSchoolStrength(state, school),
    ),
  );
  const identityRandom = new SeededRandom(state.seed).fork(
    `tournament:${academicYear}:${circuit}:national:guest-identities`,
  );
  const names = shuffle(GUEST_SCHOOL_NAMES, identityRandom).slice(0, 15);

  return names.map((displayName, slotIndex) => {
    const guestSeed = `${state.seed}::official:${circuit}:${academicYear}:national:guest:${slotIndex}`;
    const strengthRandom = new SeededRandom(guestSeed).fork("strength");
    const seedStrength = Math.round(
      clamp(strengthAverage + 8 + strengthRandom.int(-12, 18), 45, 115),
    );

    return {
      entrantId: `guest:${circuit}:${academicYear}:${slotIndex}`,
      source: "guest-representative",
      displayName,
      shortName: displayName.replace(/(高校|学院|学園|工業)$/u, ""),
      regionLabel: GUEST_REGION_LABELS[slotIndex]!,
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
        homeEntrantId: openingRound
          ? slots[slotIndex * 2]!.entrantId
          : null,
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
  const guests = createGuestEntrants(input.state, input.circuit, academicYear);
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
