import type { GameDate } from "../model/identifiers";

const DAY_MILLISECONDS = 86_400_000;

export function parseGameDate(value: GameDate): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid game date: ${value}`);
  }
  return date;
}

export function addWeeks(value: GameDate, weeks: number): GameDate {
  if (!Number.isSafeInteger(weeks)) {
    throw new Error("weeks must be a safe integer");
  }
  const date = parseGameDate(value);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10) as GameDate;
}

export function weeksBetween(from: GameDate, to: GameDate): number {
  return Math.floor(
    (parseGameDate(to).getTime() - parseGameDate(from).getTime()) /
      (7 * DAY_MILLISECONDS),
  );
}

export function monthOf(value: GameDate): number {
  return parseGameDate(value).getUTCMonth() + 1;
}
