import { ABILITY_KEYS, type Player } from "../../domain/model/Player";
import { calculateSelectionStrength } from "../../domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";

export interface SoakDistribution {
  count: number;
  min: number;
  p50: number;
  p90: number;
  max: number;
  mean: number;
}

export interface SoakSnapshotMetrics {
  seed: string;
  yearIndex: number;
  date: string;
  userFunds: number;
  yearlyIncome: number;
  yearlyExpense: number;
  userStrength: number;
  cpuStrength: SoakDistribution;
  playerAbility: SoakDistribution;
  injuredPlayers: number;
  condition: SoakDistribution;
  facilities: Record<string, number>;
  assistantCoach: { rank: string; specialty: string | null } | null;
  tournamentSummaryCount: number;
  userNationalTitles: number;
  playerTierCounts: Record<string, number>;
  growthTypeCounts: Record<string, number>;
  positionCounts: Record<string, number>;
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

function averageAbility(player: Player): number {
  return round(
    ABILITY_KEYS.reduce(
      (sum, ability) => sum + player.abilities[ability],
      0,
    ) / ABILITY_KEYS.length,
  );
}

function sortedFacilities(
  facilities: Record<string, number>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(facilities).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

export function captureSoakSnapshotMetrics(
  snapshot: CloudGameSnapshot,
): SoakSnapshotMetrics {
  const state = snapshot.state;
  const userSchool = state.schools[state.userSchoolId]!;
  const players = Object.values(state.players);
  const currentLedger = state.schoolManagement.fundsHistory.filter(
    (entry) => entry.academicYearIndex === state.yearIndex,
  );
  const yearlyIncome = currentLedger
    .filter((entry) => entry.amount > 0)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const yearlyExpense = currentLedger
    .filter((entry) => entry.amount < 0)
    .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);

  const cpuStrengthValues = Object.values(state.schools)
    .filter((school) => school.id !== state.userSchoolId)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((school) =>
      calculateSelectionStrength(
        state,
        autoSelectTeam({ state, schoolId: school.id }),
      ),
    );

  return {
    seed: state.seed,
    yearIndex: state.yearIndex,
    date: state.date,
    userFunds: userSchool.funds,
    yearlyIncome,
    yearlyExpense,
    userStrength: calculateSelectionStrength(state, snapshot.teamSelection),
    cpuStrength: distribution(cpuStrengthValues),
    playerAbility: distribution(players.map(averageAbility)),
    injuredPlayers: players.filter((player) => player.injury !== null).length,
    condition: distribution(players.map((player) => player.condition)),
    facilities: sortedFacilities(userSchool.facilities),
    assistantCoach: state.schoolManagement.assistantCoach
      ? {
          rank: state.schoolManagement.assistantCoach.rank,
          specialty: state.schoolManagement.assistantCoach.specialty,
        }
      : null,
    tournamentSummaryCount: state.history.officialTournaments.length,
    userNationalTitles: userSchool.history.nationalTitles,
    playerTierCounts: sortedCounts(players.map((player) => player.tier)),
    growthTypeCounts: sortedCounts(players.map((player) => player.growthTypeId)),
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
  return [
    `seed=${metrics.seed}`,
    `year=${metrics.yearIndex}`,
    `date=${metrics.date}`,
    `funds=${metrics.userFunds} (+${metrics.yearlyIncome}/-${metrics.yearlyExpense})`,
    `strength=${metrics.userStrength} cpu-p50=${metrics.cpuStrength.p50}`,
    `ability-mean=${metrics.playerAbility.mean}`,
    `injured=${metrics.injuredPlayers} condition-mean=${metrics.condition.mean}`,
    `national-titles=${metrics.userNationalTitles}`,
    `assistant-coach=${coach}`,
  ].join(" | ");
}
