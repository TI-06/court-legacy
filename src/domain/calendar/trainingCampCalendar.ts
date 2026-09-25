import type { GameState } from "../model/GameState";
import type { ScheduledActivity } from "../model/Calendar";
import type { GameDate } from "../model/identifiers";

export type TrainingCampSeason = "summer" | "winter";

interface TrainingCampPeriodDefinition {
  season: TrainingCampSeason;
  startWeek: number;
  durationWeeks: number;
  title: string;
}

export const TRAINING_CAMP_PERIODS = [
  {
    season: "summer",
    startWeek: 20,
    durationWeeks: 2,
    title: "夏季強化合宿",
  },
  {
    season: "winter",
    startWeek: 38,
    durationWeeks: 2,
    title: "冬季強化合宿",
  },
] as const satisfies readonly TrainingCampPeriodDefinition[];

function addWeeks(value: GameDate, weeks: number): GameDate {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`invalid game date: ${value}`);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}` as GameDate;
}

export function createAnnualTrainingCampActivities(
  academicYear: number,
  academicYearStartDate: GameDate,
): ScheduledActivity[] {
  return TRAINING_CAMP_PERIODS.flatMap((period) =>
    Array.from({ length: period.durationWeeks }, (_, index) => {
      const phase = index + 1;
      const weekOfYear = period.startWeek + index;
      return {
        id: `camp:${academicYear}:${period.season}:${phase}`,
        date: addWeeks(academicYearStartDate, weekOfYear - 1),
        type: "camp" as const,
        title: `${period.title}・${phase}週目`,
        mandatory: false,
        matchId: null,
        metadata: {
          campSeason: period.season,
          campPhase: phase,
          campDurationWeeks: period.durationWeeks,
          weekOfYear,
        },
      };
    }),
  );
}

export function findCurrentTrainingCampActivity(
  state: Pick<GameState, "date" | "calendar">,
): ScheduledActivity | null {
  return (
    state.calendar.activities.find(
      (activity) => activity.type === "camp" && activity.date === state.date,
    ) ?? null
  );
}
