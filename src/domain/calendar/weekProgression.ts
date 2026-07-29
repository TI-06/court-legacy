import type { GameState } from "../model/GameState";
import type { Player, PlayerInjury } from "../model/Player";
import type { GameDate, PlayerId } from "../model/identifiers";

export type WeeklyAction = "training" | "practice-match";

export interface WeekProgressionResult {
  state: GameState;
  recoveredPlayerIds: PlayerId[];
  healedPlayerIds: PlayerId[];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function addDays(value: GameDate, days: number): GameDate {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`invalid game date: ${value}`);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}` as GameDate;
}

function actionId(date: GameDate, action: WeeklyAction): string {
  return `week:${date}:${action}`;
}

export function isWeeklyActionCompleted(
  state: GameState,
  action: WeeklyAction,
): boolean {
  return state.calendar.completedActivityIds.includes(actionId(state.date, action));
}

export function markWeeklyActionCompleted(
  state: GameState,
  action: WeeklyAction,
): GameState {
  const id = actionId(state.date, action);
  if (state.calendar.completedActivityIds.includes(id)) {
    return state;
  }

  return {
    ...state,
    calendar: {
      ...state.calendar,
      completedActivityIds: [...state.calendar.completedActivityIds, id],
    },
  };
}

function progressInjury(injury: PlayerInjury | null): PlayerInjury | null {
  if (!injury) {
    return null;
  }

  const remainingWeeks = injury.remainingWeeks - 1;
  return remainingWeeks <= 0 ? null : { ...injury, remainingWeeks };
}

function recoverPlayer(
  player: Player,
  recoveryRoomLevel: number,
): { player: Player; recovered: boolean; healed: boolean } {
  const previousInjury = player.injury;
  const injury = progressInjury(previousInjury);
  const fatigueRecovery = 8 + recoveryRoomLevel * 2;
  const nextFatigue = clamp(player.fatigue - fatigueRecovery);
  const nextCondition = clamp(player.condition + (previousInjury ? 1 : 3));

  return {
    player: {
      ...player,
      fatigue: nextFatigue,
      condition: nextCondition,
      injury,
    },
    recovered: nextFatigue < player.fatigue || nextCondition > player.condition,
    healed: Boolean(previousInjury && !injury),
  };
}

export function advanceOneWeek(state: GameState): WeekProgressionResult {
  const players = { ...state.players };
  const recoveredPlayerIds: PlayerId[] = [];
  const healedPlayerIds: PlayerId[] = [];

  for (const [playerId, player] of Object.entries(state.players) as Array<
    [PlayerId, Player]
  >) {
    const school = state.schools[player.schoolId];
    const recoveryRoomLevel = school?.facilities.recoveryRoom ?? 0;
    const result = recoverPlayer(player, recoveryRoomLevel);
    players[playerId] = result.player;
    if (result.recovered) {
      recoveredPlayerIds.push(playerId);
    }
    if (result.healed) {
      healedPlayerIds.push(playerId);
    }
  }

  const date = addDays(state.date, 7);

  return {
    state: {
      ...state,
      date,
      players,
      activeMatch: null,
      calendar: {
        ...state.calendar,
        currentDate: date,
        weekOfYear: state.calendar.weekOfYear + 1,
      },
    },
    recoveredPlayerIds,
    healedPlayerIds,
  };
}
