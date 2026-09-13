import { ABILITY_KEYS, type Player } from "../../domain/model/Player";
import type { SchoolFacilities } from "../../domain/model/School";
import type { PlayerId } from "../../domain/model/identifiers";
import { calculateSelectionStrength } from "../../domain/selectors/matchSelectors";
import { FACILITY_MAX_LEVEL } from "../../domain/school/facilityUpgrade";
import { autoSelectTeam } from "../../domain/team/autoSelectTeam";
import type { TournamentRound } from "../../domain/tournament/tournamentTypes";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";

export interface SoakDistribution {
  count: number;
  min: number;
  p50: number;
  p90: number;
  max: number;
  mean: number;
}

export interface SoakMetricContext {
  academicYearIndex?: number;
  academicYear?: number;
  fundsStart?: number;
  fundsMin?: number;
  fundsMax?: number;
  zeroFundWeeks?: number;
  injuredPlayerWeeks?: number;
  newInjuries?: number;
  healedInjuries?: number;
  intakePlayerIds?: readonly PlayerId[];
}

export interface SoakSnapshotMetrics {
  seed: string;
  yearIndex: number;
  academicYearIndex: number;
  academicYear: number;
  date: string;
  userFunds: number;
  fundsStart: number;
  fundsEnd: number;
  fundsMin: number;
  fundsMax: number;
  zeroFundWeeks: number;
  yearlyIncome: number;
  yearlyExpense: number;
  userStrength: number;
  cpuStrength: SoakDistribution;
  playerAbility: SoakDistribution;
  yearlyGrowthTotal: number;
  growthByGrowthType: Record<string, number>;
  intakeCount: number;
  intakeTierCounts: Record<string, number>;
  intakeGrowthTypeCounts: Record<string, number>;
  injuredPlayers: number;
  injuredPlayerWeeks: number;
  newInjuries: number;
  healedInjuries: number;
  condition: SoakDistribution;
  conditionHistogram: Record<string, number>;
  facilities: Record<string, number>;
  assistantCoach: {
    rank: string;
    specialty: string | null;
    contractYearIndex: number;
  } | null;
  tournamentSummaryCount: number;
  userNationalTitles: number;
  userTournamentTitles: number;
  userBestTournamentRound: TournamentRound | null;
  nationalChampionStrength: SoakDistribution;
  playerTierCounts: Record<string, number>;
  growthTypeCounts: Record<string, number>;
  positionCounts: Record<string, number>;
}

export interface SoakFacilityProgress {
  maxObservedLevel: number;
  firstYearByLevel: Record<string, number>;
}

export interface SoakFacilityMilestoneSummary {
  facilityMaxLevel: number;
  byFacility: Record<string, SoakFacilityProgress>;
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(sorted.length * ratio) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))]!;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function distribution(values: readonly number[]): SoakDistribution {
  if (values.length === 0) {
    return { count: 0, min: 0, p50: 0, p90: 0, max: 0, mean: 0 };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    count: sorted.length,
    min: sorted[0]!,
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    max: sorted.at(-1)!,
    mean: round(total / sorted.length),
  };
}

function sortedCounts(values: readonly string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function sortedTotals(
  entries: ReadonlyMap<string, number>,
): Record<string, number> {
  return Object.fromEntries(
    [...entries.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, round(value)]),
  );
}

function averageAbility(player: Player): number {
  return round(
    ABILITY_KEYS.reduce((sum, ability) => sum + player.abilities[ability], 0) /
      ABILITY_KEYS.length,
  );
}

function sortedFacilities(
  facilities: SchoolFacilities,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(facilities).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

export function summarizeFacilityMilestones(
  yearly: readonly Pick<SoakSnapshotMetrics, "yearIndex" | "facilities">[],
): SoakFacilityMilestoneSummary {
  const facilityNames = [
    ...new Set(yearly.flatMap((metrics) => Object.keys(metrics.facilities))),
  ].sort((left, right) => left.localeCompare(right));

  const byFacility = Object.fromEntries(
    facilityNames.map((facilityName) => {
      let maxObservedLevel = 0;
      const firstYearByLevel: Record<string, number> = {};

      for (const metrics of yearly) {
        const observedLevel = metrics.facilities[facilityName];
        if (observedLevel === undefined) continue;
        const boundedLevel = Math.max(
          0,
          Math.min(FACILITY_MAX_LEVEL, observedLevel),
        );
        for (let level = maxObservedLevel + 1; level <= boundedLevel; level += 1) {
          firstYearByLevel[String(level)] = metrics.yearIndex;
        }
        maxObservedLevel = Math.max(maxObservedLevel, boundedLevel);
      }

      return [
        facilityName,
        {
          maxObservedLevel,
          firstYearByLevel,
        },
      ];
    }),
  );

  return {
    facilityMaxLevel: FACILITY_MAX_LEVEL,
    byFacility,
  };
}

function conditionHistogram(
  players: readonly Player[],
): Record<string, number> {
  const histogram = {
    "0-19": 0,
    "20-39": 0,
    "40-59": 0,
    "60-79": 0,
    "80-100": 0,
  };
  for (const player of players) {
    if (player.condition < 20) histogram["0-19"] += 1;
    else if (player.condition < 40) histogram["20-39"] += 1;
    else if (player.condition < 60) histogram["40-59"] += 1;
    else if (player.condition < 80) histogram["60-79"] += 1;
    else histogram["80-100"] += 1;
  }
  return histogram;
}

const TOURNAMENT_ROUND_RANK: Record<TournamentRound, number> = {
  "round-of-16": 1,
  quarterfinal: 2,
  semifinal: 3,
  final: 4,
};

function bestTournamentRound(
  rounds: readonly (TournamentRound | null)[],
): TournamentRound | null {
  let best: TournamentRound | null = null;
  for (const round of rounds) {
    if (!round) continue;
    if (!best || TOURNAMENT_ROUND_RANK[round] > TOURNAMENT_ROUND_RANK[best]) {
      best = round;
    }
  }
  return best;
}

export function captureSoakSnapshotMetrics(
  snapshot: CloudGameSnapshot,
  context: SoakMetricContext = {},
): SoakSnapshotMetrics {
  const state = snapshot.state;
  const userSchool = state.schools[state.userSchoolId]!;
  const players = Object.values(state.players);
  const academicYearIndex = context.academicYearIndex ?? state.yearIndex;
  const academicYear = context.academicYear ?? state.calendar.academicYear;
  const currentLedger = state.schoolManagement.fundsHistory.filter(
    (entry) => entry.academicYearIndex === academicYearIndex,
  );
  const yearlyIncome = currentLedger
    .filter((entry) => entry.amount > 0)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const yearlyExpense = currentLedger
    .filter((entry) => entry.amount < 0)
    .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  const derivedFundsStart = currentLedger[0]
    ? currentLedger[0].balanceAfter - currentLedger[0].amount
    : userSchool.funds;
  const fundsStart = context.fundsStart ?? derivedFundsStart;
  const fundsEnd =
    currentLedger.at(-1)?.balanceAfter ??
    (academicYearIndex === state.yearIndex ? userSchool.funds : fundsStart);
  const ledgerBalances = currentLedger.map((entry) => entry.balanceAfter);
  const fundsMin = Math.min(
    fundsStart,
    fundsEnd,
    context.fundsMin ?? Number.POSITIVE_INFINITY,
    ...ledgerBalances,
  );
  const fundsMax = Math.max(
    fundsStart,
    fundsEnd,
    context.fundsMax ?? Number.NEGATIVE_INFINITY,
    ...ledgerBalances,
  );

  const cpuStrengthValues = Object.values(state.schools)
    .filter((school) => school.id !== state.userSchoolId)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((school) =>
      calculateSelectionStrength(
        state,
        autoSelectTeam({ state, schoolId: school.id }),
      ),
    );

  const growthByType = new Map<string, number>();
  let yearlyGrowthTotal = 0;
  for (const week of state.history.playerDevelopmentWeeks) {
    if (week.academicYearIndex !== academicYearIndex) continue;
    for (const development of week.players) {
      yearlyGrowthTotal += development.totalAbilityGrowth;
      const growthType =
        state.players[development.playerId]?.growthTypeId ?? "unknown";
      growthByType.set(
        growthType,
        (growthByType.get(growthType) ?? 0) + development.totalAbilityGrowth,
      );
    }
  }

  const intakePlayers = [...new Set(context.intakePlayerIds ?? [])]
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => player !== undefined);

  const tournamentSummaries = state.history.officialTournaments.filter(
    (summary) => summary.academicYear === academicYear,
  );
  const nationalChampionStrengthValues = tournamentSummaries
    .filter((summary) => summary.level === "national")
    .flatMap((summary) => {
      const schoolId = summary.champion.schoolId;
      if (!schoolId || !state.schools[schoolId]) return [];
      return [
        calculateSelectionStrength(state, autoSelectTeam({ state, schoolId })),
      ];
    });

  return {
    seed: state.seed,
    yearIndex: academicYearIndex,
    academicYearIndex,
    academicYear,
    date: state.date,
    userFunds: userSchool.funds,
    fundsStart,
    fundsEnd,
    fundsMin,
    fundsMax,
    zeroFundWeeks: context.zeroFundWeeks ?? 0,
    yearlyIncome,
    yearlyExpense,
    userStrength: calculateSelectionStrength(state, snapshot.teamSelection),
    cpuStrength: distribution(cpuStrengthValues),
    playerAbility: distribution(players.map(averageAbility)),
    yearlyGrowthTotal: round(yearlyGrowthTotal),
    growthByGrowthType: sortedTotals(growthByType),
    intakeCount: intakePlayers.length,
    intakeTierCounts: sortedCounts(intakePlayers.map((player) => player.tier)),
    intakeGrowthTypeCounts: sortedCounts(
      intakePlayers.map((player) => player.growthTypeId),
    ),
    injuredPlayers: players.filter((player) => player.injury !== null).length,
    injuredPlayerWeeks: context.injuredPlayerWeeks ?? 0,
    newInjuries: context.newInjuries ?? 0,
    healedInjuries: context.healedInjuries ?? 0,
    condition: distribution(players.map((player) => player.condition)),
    conditionHistogram: conditionHistogram(players),
    facilities: sortedFacilities(userSchool.facilities),
    assistantCoach: state.schoolManagement.assistantCoach
      ? {
          rank: state.schoolManagement.assistantCoach.rank,
          specialty: state.schoolManagement.assistantCoach.specialty,
          contractYearIndex:
            state.schoolManagement.assistantCoach.contractYearIndex,
        }
      : null,
    tournamentSummaryCount: tournamentSummaries.length,
    userNationalTitles: userSchool.history.nationalTitles,
    userTournamentTitles: tournamentSummaries.filter(
      (summary) => summary.userResult.champion,
    ).length,
    userBestTournamentRound: bestTournamentRound(
      tournamentSummaries.map((summary) => summary.userResult.bestRound),
    ),
    nationalChampionStrength: distribution(nationalChampionStrengthValues),
    playerTierCounts: sortedCounts(players.map((player) => player.tier)),
    growthTypeCounts: sortedCounts(
      players.map((player) => player.growthTypeId),
    ),
    positionCounts: sortedCounts(
      players.map((player) => player.preferredPosition),
    ),
  };
}

export function formatSoakSnapshotSummary(
  metrics: SoakSnapshotMetrics,
): string {
  const coach = metrics.assistantCoach
    ? `${metrics.assistantCoach.rank}/${metrics.assistantCoach.specialty ?? "general"}`
    : "none";
  const tournament = metrics.userBestTournamentRound ?? "none";
  return [
    `seed=${metrics.seed}`,
    `year=${metrics.yearIndex}`,
    `academic-year=${metrics.academicYear}`,
    `date=${metrics.date}`,
    `funds=${metrics.fundsEnd} start=${metrics.fundsStart} min=${metrics.fundsMin} max=${metrics.fundsMax} (+${metrics.yearlyIncome}/-${metrics.yearlyExpense}) zero-weeks=${metrics.zeroFundWeeks}`,
    `strength=${metrics.userStrength} cpu-p50=${metrics.cpuStrength.p50}`,
    `ability-mean=${metrics.playerAbility.mean} growth=${metrics.yearlyGrowthTotal}`,
    `intake=${metrics.intakeCount}`,
    `injured=${metrics.injuredPlayers} injury-weeks=${metrics.injuredPlayerWeeks} new=${metrics.newInjuries} healed=${metrics.healedInjuries} condition-mean=${metrics.condition.mean}`,
    `tournament=${tournament} titles=${metrics.userTournamentTitles} national-titles=${metrics.userNationalTitles}`,
    `assistant-coach=${coach}`,
  ].join(" | ");
}
