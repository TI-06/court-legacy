import type {
  GameState,
  PlayerDevelopmentWeek,
} from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import type { PlayerId } from "../../domain/model/identifiers";
import { calculatePlayerDisplayPower } from "../../domain/selectors/playerPresentation";

export type PlayerHubFilter =
  | "all"
  | "grade-1"
  | "grade-2"
  | "grade-3"
  | "position-OH"
  | "position-MB"
  | "position-OP"
  | "position-S"
  | "position-L"
  | "starter"
  | "bench"
  | "priority"
  | "injured";

export type PlayerHubSort =
  "power" | "potential" | "condition" | "growth-4w" | "grade";

export interface PlayerGrowthTrendPoint {
  gameDate: GameState["date"];
  totalAbilityGrowth: number;
}

export interface PlayerGrowthSummary {
  fourWeekGrowth: number | null;
  twelveWeekGrowth: number | null;
  observedWeeks4: number;
  observedWeeks12: number;
  trend12: PlayerGrowthTrendPoint[];
}

export interface PlayerHubRosterItem {
  player: Player;
  displayPower: number;
  potential: number | null;
  isStarter: boolean;
  isBench: boolean;
  isPriority: boolean;
  isInjured: boolean;
  growth: PlayerGrowthSummary;
}

export interface SelectPlayerHubRosterInput {
  state: GameState;
  selection: TeamSelection;
  filter: PlayerHubFilter;
  sort: PlayerHubSort;
}

interface ObservedGrowth {
  gameDate: GameState["date"];
  growth: number;
}

function summarizeWindow(
  weeks: readonly PlayerDevelopmentWeek[],
  playerId: PlayerId,
): { growth: number | null; observed: ObservedGrowth[] } {
  const observed: ObservedGrowth[] = [];

  for (const week of weeks) {
    const log = week.players.find(
      (candidate) => candidate.playerId === playerId,
    );
    if (!log) continue;
    observed.push({
      gameDate: week.gameDate,
      growth: log.totalAbilityGrowth,
    });
  }

  return {
    growth:
      observed.length === 0
        ? null
        : observed.reduce((sum, item) => sum + item.growth, 0),
    observed,
  };
}

export function summarizePlayerGrowth(
  state: GameState,
  playerId: PlayerId,
): PlayerGrowthSummary {
  const four = summarizeWindow(
    state.history.playerDevelopmentWeeks.slice(-4),
    playerId,
  );
  const twelve = summarizeWindow(
    state.history.playerDevelopmentWeeks.slice(-12),
    playerId,
  );

  return {
    fourWeekGrowth: four.growth,
    twelveWeekGrowth: twelve.growth,
    observedWeeks4: four.observed.length,
    observedWeeks12: twelve.observed.length,
    trend12: twelve.observed.map((item) => ({
      gameDate: item.gameDate,
      totalAbilityGrowth: item.growth,
    })),
  };
}

function compareNullableDesc(left: number | null, right: number | null) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}

function filterRosterItem(
  item: PlayerHubRosterItem,
  filter: PlayerHubFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "starter") return item.isStarter;
  if (filter === "bench") return item.isBench;
  if (filter === "priority") return item.isPriority;
  if (filter === "injured") return item.isInjured;

  if (filter.startsWith("grade-")) {
    return item.player.grade === Number(filter.slice("grade-".length));
  }

  if (filter.startsWith("position-")) {
    return item.player.preferredPosition === filter.slice("position-".length);
  }

  return false;
}

function primarySort(
  left: PlayerHubRosterItem,
  right: PlayerHubRosterItem,
  sort: PlayerHubSort,
): number {
  switch (sort) {
    case "power":
      return right.displayPower - left.displayPower;
    case "potential":
      return compareNullableDesc(left.potential, right.potential);
    case "condition":
      return right.player.condition - left.player.condition;
    case "growth-4w":
      return compareNullableDesc(
        left.growth.fourWeekGrowth,
        right.growth.fourWeekGrowth,
      );
    case "grade":
      return right.player.grade - left.player.grade;
  }
}

export function selectPlayerHubRoster(
  input: SelectPlayerHubRosterInput,
): PlayerHubRosterItem[] {
  const school = input.state.schools[input.state.userSchoolId];
  if (!school) return [];

  const starterIds = new Set([
    ...input.selection.rotation.map((assignment) => assignment.playerId),
    ...(input.selection.liberoPlayerId ? [input.selection.liberoPlayerId] : []),
  ]);
  const benchIds = new Set(input.selection.benchPlayerIds);
  const priorityIds = new Set(
    input.state.teamPlanning.developmentPriorityPlayerIds,
  );

  return school.playerIds
    .map((playerId) => input.state.players[playerId])
    .filter((player): player is Player => Boolean(player))
    .map<PlayerHubRosterItem>((player) => ({
      player,
      displayPower: calculatePlayerDisplayPower(player),
      potential:
        typeof player.potential === "number"
          ? Math.round(player.potential)
          : null,
      isStarter: starterIds.has(player.id),
      isBench: benchIds.has(player.id),
      isPriority: priorityIds.has(player.id),
      isInjured: player.injury !== null,
      growth: summarizePlayerGrowth(input.state, player.id),
    }))
    .filter((item) => filterRosterItem(item, input.filter))
    .sort((left, right) => {
      const primary = primarySort(left, right, input.sort);
      if (primary !== 0) return primary;

      if (input.sort !== "power") {
        const power = right.displayPower - left.displayPower;
        if (power !== 0) return power;
      }

      return left.player.id.localeCompare(right.player.id);
    });
}
