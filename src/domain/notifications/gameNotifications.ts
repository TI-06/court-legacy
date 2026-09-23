import type { GameDataRegistry } from "../../data/dataRegistry";
import type { ResolvedPlayerConcern } from "../dynamics/concernResolution";
import type { PlayerConcernCode } from "../dynamics/teamDynamicsTypes";
import type { GameState } from "../model/GameState";
import type { GameDate, MatchId, PlayerId } from "../model/identifiers";
import type { Position } from "../model/Player";
import type { CharacterTraitDiscovery } from "../player/characterTraitDiscovery";
import {
  developmentGoalAreaLabels,
  getPlayerDevelopmentGoalProgress,
} from "../player/playerDevelopmentGoals";
import { summarizePlayerAbilities } from "../selectors/playerPresentation";
import { ratingToGrade } from "../selectors/ratingGrades";
import { evaluateSeasonGoals } from "../season/seasonGoals";
import { seasonGoalFundReward } from "../season/seasonGoalRewards";
import type { SeasonGoalResult } from "../season/seasonGoalTypes";
import type {
  DevelopmentGoalArea,
  DevelopmentGoalGrade,
} from "../team/teamPlanningTypes";
import type { TrainingResult } from "../training/resolveWeeklyTraining";
import type { RelationshipTrainingModifierSummary } from "../training/relationshipTrainingModifiers";
import type {
  SpecialRelationshipKind,
  SpecialRelationshipTransition,
} from "../relationships/relationshipTypes";
import type { AbilityKey } from "../validation/gameDataSchema";

export interface TrainingResultRankUp {
  area: DevelopmentGoalArea;
  areaLabel: string;
  fromGrade: DevelopmentGoalGrade;
  toGrade: DevelopmentGoalGrade;
}

export interface TrainingResultNotificationPlayer {
  playerId: PlayerId;
  displayName: string;
  grade: number;
  preferredPosition: Position;
  totalAbilityGrowth: number;
  fatigueChange: number;
  conditionChange: number;
  trustChange: number;
  injured: boolean;
  abilityChanges: Partial<Record<AbilityKey, number>>;
  rankUps?: TrainingResultRankUp[];
  socialGrowth: RelationshipTrainingModifierSummary;
}

export interface TrainingResultNotificationPayload {
  teamTrainingMenuName: string;
  totalAbilityGrowth: number;
  totalFatigueChange: number;
  injuredCount: number;
  players: TrainingResultNotificationPlayer[];
}

export interface TrainingResultNotification {
  id: string;
  type: "training-result";
  createdGameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  readAtGameDate: GameDate | null;
  payload: TrainingResultNotificationPayload;
}

export interface ConcernResolutionNotificationItem {
  playerId: PlayerId;
  displayName: string;
  concernCode: PlayerConcernCode;
  concernTitle: string;
}

export interface ConcernResolutionNotification {
  id: string;
  type: "concern-resolution";
  createdGameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  readAtGameDate: GameDate | null;
  payload: {
    items: ConcernResolutionNotificationItem[];
  };
}

export interface SpecialRelationshipNotification {
  id: string;
  type: "special-relationship";
  createdGameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  readAtGameDate: GameDate | null;
  payload: {
    action: SpecialRelationshipTransition["action"];
    kind: SpecialRelationshipKind;
    kindLabel: string;
    playerIds: [PlayerId, PlayerId];
    displayNames: [string, string];
  };
}

export interface CharacterTraitDiscoveredNotification {
  id: string;
  type: "character-trait-discovered";
  createdGameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  readAtGameDate: GameDate | null;
  payload: {
    playerId: PlayerId;
    displayName: string;
    traitId: string;
    traitName: string;
    description: string;
  };
}

export interface DevelopmentGoalAchievementNotificationItem {
  playerId: PlayerId;
  displayName: string;
  area: DevelopmentGoalArea;
  areaLabel: string;
  targetGrade: DevelopmentGoalGrade;
  achievedGrade: DevelopmentGoalGrade;
}

export interface DevelopmentGoalAchievementNotification {
  id: string;
  type: "development-goal-achieved";
  createdGameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  readAtGameDate: GameDate | null;
  payload: {
    items: DevelopmentGoalAchievementNotificationItem[];
  };
}

export interface SeasonGoalAchievementNotificationItem {
  goalId: string;
  label: string;
  rewardFunds: number;
}

export interface SeasonGoalAchievementNotification {
  id: string;
  type: "season-goal-achieved";
  createdGameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  readAtGameDate: GameDate | null;
  payload: {
    items: SeasonGoalAchievementNotificationItem[];
    totalRewardFunds: number;
  };
}

export type GameNotification =
  | TrainingResultNotification
  | ConcernResolutionNotification
  | SpecialRelationshipNotification
  | CharacterTraitDiscoveredNotification
  | DevelopmentGoalAchievementNotification
  | SeasonGoalAchievementNotification;

export interface GameNotificationState {
  items: GameNotification[];
}

export interface BuildTrainingResultNotificationInput {
  stateBeforeTraining: GameState;
  result: TrainingResult;
  data: GameDataRegistry;
}

const concernTitles: Record<PlayerConcernCode, string> = {
  "playing-time": "出場機会への不満",
  "role-mismatch": "役割への不満",
  "injury-overuse": "怪我中の起用負荷",
  "team-slump": "チーム不調への不満",
};

const specialRelationshipKindLabels: Record<SpecialRelationshipKind, string> = {
  rival: "ライバル",
  mentor: "師弟",
  partner: "相棒",
};

function trainingNotificationId(state: GameState): string {
  return `training-result:${state.userSchoolId}:${state.yearIndex}:${state.calendar.weekOfYear}:${state.date}`;
}

const developmentGradeOrder: readonly DevelopmentGoalGrade[] = [
  "G",
  "F",
  "E",
  "D",
  "C",
  "B",
  "A",
  "S",
];

function buildTrainingRankUps(
  player: GameState["players"][PlayerId],
  abilityChanges: Partial<Record<AbilityKey, number>>,
): TrainingResultRankUp[] {
  const afterPlayer = {
    ...player,
    abilities: { ...player.abilities },
  };
  for (const [ability, change] of Object.entries(abilityChanges) as [
    AbilityKey,
    number | undefined,
  ][]) {
    if (typeof change !== "number" || change === 0) continue;
    afterPlayer.abilities[ability] = Math.max(
      0,
      Math.min(100, afterPlayer.abilities[ability] + change),
    );
  }

  const beforeSummary = summarizePlayerAbilities(player);
  const afterSummary = summarizePlayerAbilities(afterPlayer);
  const areas = Object.keys(developmentGoalAreaLabels) as DevelopmentGoalArea[];

  return areas.flatMap((area) => {
    const fromGrade = ratingToGrade(
      beforeSummary[area],
    ) as DevelopmentGoalGrade;
    const toGrade = ratingToGrade(afterSummary[area]) as DevelopmentGoalGrade;
    if (
      fromGrade === toGrade ||
      developmentGradeOrder.indexOf(toGrade) <=
        developmentGradeOrder.indexOf(fromGrade)
    ) {
      return [];
    }
    return [
      {
        area,
        areaLabel: developmentGoalAreaLabels[area],
        fromGrade,
        toGrade,
      },
    ];
  });
}

export function buildTrainingResultNotification(
  input: BuildTrainingResultNotificationInput,
): TrainingResultNotification {
  const injuredPlayerIds = new Set(input.result.injuredPlayerIds);
  const menu = input.data.trainingMenus.get(input.result.teamTrainingMenuId);

  const players = input.result.playerLogs.map((log) => {
    const player = input.stateBeforeTraining.players[log.playerId];
    if (!player) {
      throw new Error(
        `training notification references unknown player: ${log.playerId}`,
      );
    }

    return {
      playerId: player.id,
      displayName: `${player.lastName} ${player.firstName}`,
      grade: player.grade,
      preferredPosition: player.preferredPosition,
      totalAbilityGrowth: log.totalAbilityGrowth,
      fatigueChange: log.fatigueChange,
      conditionChange: log.conditionChange,
      trustChange: log.trustChange,
      injured: injuredPlayerIds.has(player.id) || log.injury !== null,
      abilityChanges: { ...log.abilityChanges },
      rankUps: buildTrainingRankUps(player, log.abilityChanges),
      socialGrowth: {
        contributions: log.socialGrowth.contributions.map((contribution) => ({
          ...contribution,
        })),
        rawPercentPoints: log.socialGrowth.rawPercentPoints,
        appliedPercentPoints: log.socialGrowth.appliedPercentPoints,
        capped: log.socialGrowth.capped,
      },
    } satisfies TrainingResultNotificationPlayer;
  });

  return {
    id: trainingNotificationId(input.stateBeforeTraining),
    type: "training-result",
    createdGameDate: input.stateBeforeTraining.date,
    academicYearIndex: input.stateBeforeTraining.yearIndex,
    weekOfYear: input.stateBeforeTraining.calendar.weekOfYear,
    readAtGameDate: null,
    payload: {
      teamTrainingMenuName: menu?.name ?? input.result.teamTrainingMenuId,
      totalAbilityGrowth: players.reduce(
        (total, player) => total + player.totalAbilityGrowth,
        0,
      ),
      totalFatigueChange: players.reduce(
        (total, player) => total + player.fatigueChange,
        0,
      ),
      injuredCount: input.result.injuredPlayerIds.length,
      players,
    },
  };
}

export function buildDevelopmentGoalAchievementNotification(input: {
  stateBeforeTraining: GameState;
  stateAfterTraining: GameState;
}): DevelopmentGoalAchievementNotification | null {
  const goals =
    input.stateBeforeTraining.teamPlanning.developmentGoalsByPlayerId ?? {};
  const items = Object.entries(goals).flatMap(([rawPlayerId, goal]) => {
    if (!goal) return [];
    const playerId = rawPlayerId as PlayerId;
    const beforePlayer = input.stateBeforeTraining.players[playerId];
    const afterPlayer = input.stateAfterTraining.players[playerId];
    if (!beforePlayer || !afterPlayer) return [];

    const before = getPlayerDevelopmentGoalProgress(beforePlayer, goal);
    const after = getPlayerDevelopmentGoalProgress(afterPlayer, goal);
    if (before.achieved || !after.achieved) return [];

    return [
      {
        playerId,
        displayName: `${afterPlayer.lastName} ${afterPlayer.firstName}`,
        area: goal.area,
        areaLabel: after.areaLabel,
        targetGrade: goal.targetGrade,
        achievedGrade: after.currentGrade,
      } satisfies DevelopmentGoalAchievementNotificationItem,
    ];
  });

  if (items.length === 0) return null;

  items.sort(
    (left, right) =>
      left.displayName.localeCompare(right.displayName, "ja") ||
      String(left.playerId).localeCompare(String(right.playerId)),
  );

  return {
    id: `development-goal-achieved:${input.stateBeforeTraining.userSchoolId}:${input.stateBeforeTraining.yearIndex}:${input.stateBeforeTraining.calendar.weekOfYear}:${input.stateBeforeTraining.date}`,
    type: "development-goal-achieved",
    createdGameDate: input.stateBeforeTraining.date,
    academicYearIndex: input.stateBeforeTraining.yearIndex,
    weekOfYear: input.stateBeforeTraining.calendar.weekOfYear,
    readAtGameDate: null,
    payload: { items },
  };
}

function seasonGoalNotificationLabel(goal: SeasonGoalResult): string {
  if (goal.kind === "regional-rank") return `県内${goal.target}位以内`;
  if (goal.kind === "official-wins") return `公式戦${goal.target}勝`;
  if (goal.achievement === "national-title") return "全国大会優勝";
  if (goal.achievement === "national-appearance") return "全国大会出場";
  return "県大会優勝";
}

export function buildSeasonGoalAchievementNotification(input: {
  stateBeforeAction: GameState;
  stateAfterAction: GameState;
}): SeasonGoalAchievementNotification | null {
  const beforeGoals = input.stateBeforeAction.seasonGoals;
  const afterGoals = input.stateAfterAction.seasonGoals;
  if (
    !beforeGoals ||
    !afterGoals ||
    beforeGoals.yearIndex !== afterGoals.yearIndex ||
    beforeGoals.yearIndex !== input.stateAfterAction.yearIndex
  ) {
    return null;
  }

  const before = evaluateSeasonGoals(input.stateBeforeAction, beforeGoals);
  const after = evaluateSeasonGoals(input.stateAfterAction, afterGoals);
  const achievedBefore = new Map(
    before.goalResults.map((goal) => [goal.id, goal.achieved]),
  );
  const ambition = afterGoals.ambition ?? "challenge";
  const items = after.goalResults.flatMap((goal) => {
    if (achievedBefore.get(goal.id) === true || !goal.achieved) return [];
    return [
      {
        goalId: goal.id,
        label: seasonGoalNotificationLabel(goal),
        rewardFunds: seasonGoalFundReward(goal, ambition),
      } satisfies SeasonGoalAchievementNotificationItem,
    ];
  });

  if (items.length === 0) return null;
  items.sort((left, right) => left.goalId.localeCompare(right.goalId));

  return {
    id: `season-goal-achieved:${input.stateAfterAction.userSchoolId}:${input.stateAfterAction.yearIndex}:${input.stateAfterAction.date}:${items.map((item) => item.goalId).join(",")}`,
    type: "season-goal-achieved",
    createdGameDate: input.stateAfterAction.date,
    academicYearIndex: input.stateAfterAction.yearIndex,
    weekOfYear: input.stateAfterAction.calendar.weekOfYear,
    readAtGameDate: null,
    payload: {
      items,
      totalRewardFunds: items.reduce(
        (total, item) => total + item.rewardFunds,
        0,
      ),
    },
  };
}

export function buildConcernResolutionNotification(input: {
  state: GameState;
  matchId: MatchId;
  resolved: readonly ResolvedPlayerConcern[];
}): ConcernResolutionNotification {
  const items = input.resolved.map((resolved) => {
    const player = input.state.players[resolved.playerId];
    if (!player) {
      throw new Error(
        `concern resolution notification references unknown player: ${resolved.playerId}`,
      );
    }

    return {
      playerId: player.id,
      displayName: `${player.lastName} ${player.firstName}`,
      concernCode: resolved.code,
      concernTitle: concernTitles[resolved.code],
    } satisfies ConcernResolutionNotificationItem;
  });

  return {
    id: `concern-resolution:${input.matchId}`,
    type: "concern-resolution",
    createdGameDate: input.state.date,
    academicYearIndex: input.state.yearIndex,
    weekOfYear: input.state.calendar.weekOfYear,
    readAtGameDate: null,
    payload: { items },
  };
}

export function buildSpecialRelationshipNotification(input: {
  state: GameState;
  transition: SpecialRelationshipTransition;
}): SpecialRelationshipNotification {
  const [leftId, rightId] = input.transition.playerIds;
  const left = input.state.players[leftId];
  const right = input.state.players[rightId];
  if (!left || !right) {
    throw new Error(
      "special relationship notification references unknown player",
    );
  }
  const pairKey = input.transition.playerIds.join(":");

  return {
    id: `special-relationship:${input.state.userSchoolId}:${input.state.yearIndex}:${input.state.calendar.weekOfYear}:${input.state.date}:${input.transition.action}:${input.transition.kind}:${pairKey}`,
    type: "special-relationship",
    createdGameDate: input.state.date,
    academicYearIndex: input.state.yearIndex,
    weekOfYear: input.state.calendar.weekOfYear,
    readAtGameDate: null,
    payload: {
      action: input.transition.action,
      kind: input.transition.kind,
      kindLabel: specialRelationshipKindLabels[input.transition.kind],
      playerIds: [...input.transition.playerIds] as [PlayerId, PlayerId],
      displayNames: [
        `${left.lastName} ${left.firstName}`,
        `${right.lastName} ${right.firstName}`,
      ],
    },
  };
}

export function buildCharacterTraitDiscoveredNotification(
  state: GameState,
  discovery: CharacterTraitDiscovery,
  data: GameDataRegistry,
): CharacterTraitDiscoveredNotification {
  const player = state.players[discovery.playerId];
  if (!player) {
    throw new Error(
      `character trait notification references unknown player: ${discovery.playerId}`,
    );
  }
  const trait = data.characterTraits.get(discovery.traitId);
  if (!trait) {
    throw new Error(
      `character trait notification references unknown trait: ${discovery.traitId}`,
    );
  }
  return {
    id: `character-trait-discovered:${state.userSchoolId}:${state.yearIndex}:${state.calendar.weekOfYear}:${state.date}:${discovery.playerId}:${discovery.traitId}`,
    type: "character-trait-discovered",
    createdGameDate: state.date,
    academicYearIndex: state.yearIndex,
    weekOfYear: state.calendar.weekOfYear,
    readAtGameDate: null,
    payload: {
      playerId: player.id,
      displayName: `${player.lastName} ${player.firstName}`,
      traitId: trait.id,
      traitName: trait.name,
      description: trait.description,
    },
  };
}

export function appendNotification(
  state: GameNotificationState,
  item: GameNotification,
): GameNotificationState {
  if (state.items.some((candidate) => candidate.id === item.id)) {
    return state;
  }

  return {
    items: [
      ...state.items.filter((candidate) => candidate.type !== item.type),
      item,
    ],
  };
}

export function markNotificationRead(
  state: GameNotificationState,
  notificationId: string,
  readDate: GameDate,
): GameNotificationState {
  const index = state.items.findIndex((item) => item.id === notificationId);
  if (index < 0 || state.items[index]?.readAtGameDate !== null) {
    return state;
  }

  return {
    items: state.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, readAtGameDate: readDate } : item,
    ),
  };
}

export function selectHomeTrainingNotifications(
  state: GameNotificationState,
): TrainingResultNotification[] {
  const trainingItems = state.items.filter(
    (item): item is TrainingResultNotification =>
      item.type === "training-result",
  );
  const newest = trainingItems[trainingItems.length - 1];
  return newest ? [newest] : [];
}

export function selectHomeConcernResolutionNotifications(
  state: GameNotificationState,
): ConcernResolutionNotification[] {
  const concernItems = state.items.filter(
    (item): item is ConcernResolutionNotification =>
      item.type === "concern-resolution",
  );
  const newest = concernItems[concernItems.length - 1];
  return newest ? [newest] : [];
}

export function selectHomeSpecialRelationshipNotifications(
  state: GameNotificationState,
): SpecialRelationshipNotification[] {
  const items = state.items.filter(
    (item): item is SpecialRelationshipNotification =>
      item.type === "special-relationship",
  );
  const newest = items[items.length - 1];
  return newest ? [newest] : [];
}

export function selectHomeDevelopmentGoalAchievementNotifications(
  state: GameNotificationState,
): DevelopmentGoalAchievementNotification[] {
  const items = state.items.filter(
    (item): item is DevelopmentGoalAchievementNotification =>
      item.type === "development-goal-achieved",
  );
  const newest = items[items.length - 1];
  return newest ? [newest] : [];
}

export function selectHomeSeasonGoalAchievementNotifications(
  state: GameNotificationState,
): SeasonGoalAchievementNotification[] {
  const items = state.items.filter(
    (item): item is SeasonGoalAchievementNotification =>
      item.type === "season-goal-achieved",
  );
  const newest = items[items.length - 1];
  return newest ? [newest] : [];
}

export function selectHomeCharacterTraitNotifications(
  state: GameNotificationState,
): CharacterTraitDiscoveredNotification[] {
  const items = state.items.filter(
    (item): item is CharacterTraitDiscoveredNotification =>
      item.type === "character-trait-discovered",
  );
  const newest = items[items.length - 1];
  return newest ? [newest] : [];
}
