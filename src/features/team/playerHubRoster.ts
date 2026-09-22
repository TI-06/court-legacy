import type {
  GameState,
  PlayerDevelopmentWeek,
} from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import type { PlayerId } from "../../domain/model/identifiers";
import {
  calculatePlayerDisplayPower,
  summarizePlayerAbilities,
  type PlayerAbilitySummary,
} from "../../domain/selectors/playerPresentation";

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
  | "injured"
  | "growth-attention";

export type PlayerHubSort =
  | "power"
  | "potential"
  | "condition"
  | "growth-4w"
  | "growth-attention"
  | "grade";

export interface PlayerGrowthTrendPoint {
  gameDate: GameState["date"];
  totalAbilityGrowth: number;
}

export type PlayerGrowthMomentum =
  "measuring" | "accelerating" | "steady" | "slowing" | "stalled";

export interface PlayerGrowthSummary {
  fourWeekAbilityGrowth: PlayerAbilitySummary | null;
  fourWeekGrowth: number | null;
  previousFourWeekGrowth: number | null;
  twelveWeekGrowth: number | null;
  observedWeeks4: number;
  previousObservedWeeks4: number;
  observedWeeks12: number;
  momentum: PlayerGrowthMomentum;
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

export const playerGrowthMomentumLabels: Record<PlayerGrowthMomentum, string> =
  {
    measuring: "計測中",
    accelerating: "加速",
    steady: "安定",
    slowing: "鈍化",
    stalled: "停滞",
  };

function growthMomentum(
  recent: { growth: number | null; observed: ObservedGrowth[] },
  previous: { growth: number | null; observed: ObservedGrowth[] },
): PlayerGrowthMomentum {
  if (recent.observed.length < 2 || previous.observed.length < 2) {
    return "measuring";
  }

  const recentAverage = (recent.growth ?? 0) / recent.observed.length;
  const previousAverage = (previous.growth ?? 0) / previous.observed.length;

  if (recentAverage === 0) return "stalled";
  if (previousAverage === 0) return "accelerating";

  const ratio = recentAverage / previousAverage;
  if (ratio >= 1.25) return "accelerating";
  if (ratio <= 0.75) return "slowing";
  return "steady";
}

function summarizeFourWeekAbilityGrowth(
  state: GameState,
  player: Player,
): PlayerAbilitySummary | null {
  const weeks = state.history.playerDevelopmentWeeks.slice(-4);
  const rawChanges = {
    spike: 0,
    receive: 0,
    serve: 0,
    block: 0,
    jump: 0,
    speed: 0,
    stamina: 0,
    decision: 0,
    mental: 0,
    set: 0,
  };
  let observed = false;

  for (const week of weeks) {
    const log = week.players.find(
      (candidate) => candidate.playerId === player.id,
    );
    if (!log) continue;
    observed = true;
    for (const [ability, change] of Object.entries(log.abilityChanges)) {
      if (typeof change !== "number") continue;
      rawChanges[ability as keyof typeof rawChanges] += change;
    }
  }

  if (!observed) return null;

  const fourWeeksAgo: Player = {
    ...player,
    abilities: { ...player.abilities },
  };
  for (const [ability, change] of Object.entries(rawChanges)) {
    const key = ability as keyof typeof fourWeeksAgo.abilities;
    fourWeeksAgo.abilities[key] = Math.max(
      0,
      Math.min(100, fourWeeksAgo.abilities[key] - change),
    );
  }

  const before = summarizePlayerAbilities(fourWeeksAgo);
  const current = summarizePlayerAbilities(player);
  return {
    attack: current.attack - before.attack,
    defense: current.defense - before.defense,
    jump: current.jump - before.jump,
    stamina: current.stamina - before.stamina,
    mental: current.mental - before.mental,
  };
}

export function summarizePlayerGrowth(
  state: GameState,
  playerId: PlayerId,
): PlayerGrowthSummary {
  const weeks = state.history.playerDevelopmentWeeks;
  const four = summarizeWindow(weeks.slice(-4), playerId);
  const previousFour = summarizeWindow(weeks.slice(-8, -4), playerId);
  const twelve = summarizeWindow(weeks.slice(-12), playerId);

  const player = state.players[playerId];

  return {
    fourWeekAbilityGrowth: player
      ? summarizeFourWeekAbilityGrowth(state, player)
      : null,
    fourWeekGrowth: four.growth,
    previousFourWeekGrowth: previousFour.growth,
    twelveWeekGrowth: twelve.growth,
    observedWeeks4: four.observed.length,
    previousObservedWeeks4: previousFour.observed.length,
    observedWeeks12: twelve.observed.length,
    momentum: growthMomentum(four, previousFour),
    trend12: twelve.observed.map((item) => ({
      gameDate: item.gameDate,
      totalAbilityGrowth: item.growth,
    })),
  };
}

function compareNullableDesc(
  left: number | null,
  right: number | null,
): number {
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
  if (filter === "growth-attention") {
    return (
      item.growth.momentum === "slowing" || item.growth.momentum === "stalled"
    );
  }

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
    case "growth-attention": {
      const attentionRank: Record<PlayerGrowthMomentum, number> = {
        stalled: 0,
        slowing: 1,
        measuring: 2,
        steady: 3,
        accelerating: 4,
      };
      return (
        attentionRank[left.growth.momentum] -
        attentionRank[right.growth.momentum]
      );
    }
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
