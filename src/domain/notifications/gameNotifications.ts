import type { GameDataRegistry } from "../../data/dataRegistry";
import type { GameState } from "../model/GameState";
import type { GameDate, PlayerId } from "../model/identifiers";
import type { Position } from "../model/Player";
import type { TrainingResult } from "../training/resolveWeeklyTraining";
import type { AbilityKey } from "../validation/gameDataSchema";

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

export type GameNotification = TrainingResultNotification;

export interface GameNotificationState {
  items: GameNotification[];
}

export interface BuildTrainingResultNotificationInput {
  stateBeforeTraining: GameState;
  result: TrainingResult;
  data: GameDataRegistry;
}

const MAX_NOTIFICATION_ITEMS = 20;

function trainingNotificationId(state: GameState): string {
  return `training-result:${state.userSchoolId}:${state.yearIndex}:${state.calendar.weekOfYear}:${state.date}`;
}

export function buildTrainingResultNotification(
  input: BuildTrainingResultNotificationInput,
): TrainingResultNotification {
  const injuredPlayerIds = new Set(input.result.injuredPlayerIds);
  const menu = input.data.trainingMenus.get(input.result.teamTrainingMenuId);

  const players = input.result.playerLogs.map((log) => {
    const player = input.stateBeforeTraining.players[log.playerId];
    if (!player) {
      throw new Error(`training notification references unknown player: ${log.playerId}`);
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

export function appendNotification(
  state: GameNotificationState,
  item: GameNotification,
): GameNotificationState {
  if (state.items.some((candidate) => candidate.id === item.id)) {
    return state;
  }

  const items = [...state.items, item];
  while (items.length > MAX_NOTIFICATION_ITEMS) {
    const oldestReadIndex = items.findIndex(
      (candidate) => candidate.readAtGameDate !== null,
    );
    if (oldestReadIndex >= 0) {
      items.splice(oldestReadIndex, 1);
      continue;
    }

    // The save format is strictly bounded. If every retained item is unread,
    // keep the newest notifications rather than dropping the new result.
    items.shift();
  }

  return { items };
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
    (item): item is TrainingResultNotification => item.type === "training-result",
  );
  if (trainingItems.length === 0) return [];

  const unread = trainingItems
    .filter((item) => item.readAtGameDate === null)
    .reverse();
  const newest = trainingItems[trainingItems.length - 1]!;
  const visible = [...unread];

  if (
    newest.readAtGameDate !== null &&
    !visible.some((item) => item.id === newest.id)
  ) {
    visible.push(newest);
  }

  return visible.slice(0, 2);
}
