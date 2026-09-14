import type { GameDataRegistry } from "../../data/dataRegistry";
import type { ResolvedPlayerConcern } from "../dynamics/concernResolution";
import type { PlayerConcernCode } from "../dynamics/teamDynamicsTypes";
import type { GameState } from "../model/GameState";
import type { GameDate, MatchId, PlayerId } from "../model/identifiers";
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

export type GameNotification =
  | TrainingResultNotification
  | ConcernResolutionNotification;

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
