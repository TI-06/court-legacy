import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  createAnnualTrainingCampActivities,
  findCurrentTrainingCampActivity,
} from "../../../../src/domain/calendar/trainingCampCalendar";

describe("training camp calendar", () => {
  it("schedules two summer weeks and two winter weeks without growing history", () => {
    const activities = createAnnualTrainingCampActivities(1, "2026-04-01");

    expect(activities).toHaveLength(4);
    expect(
      activities.map((activity) => ({
        id: activity.id,
        date: activity.date,
        title: activity.title,
        weekOfYear: activity.metadata.weekOfYear,
      })),
    ).toEqual([
      {
        id: "camp:1:summer:1",
        date: "2026-08-12",
        title: "夏季強化合宿・1週目",
        weekOfYear: 20,
      },
      {
        id: "camp:1:summer:2",
        date: "2026-08-19",
        title: "夏季強化合宿・2週目",
        weekOfYear: 21,
      },
      {
        id: "camp:1:winter:1",
        date: "2026-12-16",
        title: "冬季強化合宿・1週目",
        weekOfYear: 38,
      },
      {
        id: "camp:1:winter:2",
        date: "2026-12-23",
        title: "冬季強化合宿・2週目",
        weekOfYear: 39,
      },
    ]);
  });

  it("finds only the camp scheduled for the current game date", () => {
    const state = createDemoGame();
    const camp = state.calendar.activities[0];
    expect(camp?.type).toBe("camp");
    if (!camp) throw new Error("camp fixture missing");

    state.date = camp.date;
    state.calendar.currentDate = camp.date;

    expect(findCurrentTrainingCampActivity(state)?.id).toBe(camp.id);

    state.date = "2026-08-13";
    state.calendar.currentDate = state.date;
    expect(findCurrentTrainingCampActivity(state)).toBeNull();
  });
});
