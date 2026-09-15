import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { GameDate } from "../../../../src/domain/model/identifiers";
import {
  appendNotification,
  buildSpecialRelationshipNotification,
  selectHomeSpecialRelationshipNotifications,
} from "../../../../src/domain/notifications/gameNotifications";

function firstPair() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const [left, right] = school.playerIds;
  if (!left || !right) throw new Error("players missing");
  return { state, left, right };
}

describe("Phase21 special relationship notifications", () => {
  it("builds a presentation-safe establishment snapshot", () => {
    const { state, left, right } = firstPair();
    const leftPlayer = state.players[left]!;
    const rightPlayer = state.players[right]!;
    const notification = buildSpecialRelationshipNotification({
      state,
      transition: {
        action: "established",
        kind: "partner",
        playerIds: [left, right].sort() as [typeof left, typeof right],
      },
    });

    expect(notification).toMatchObject({
      type: "special-relationship",
      createdGameDate: state.date,
      academicYearIndex: state.yearIndex,
      weekOfYear: state.calendar.weekOfYear,
      readAtGameDate: null,
      payload: {
        action: "established",
        kind: "partner",
        kindLabel: "相棒",
        displayNames: [
          `${leftPlayer.lastName} ${leftPlayer.firstName}`,
          `${rightPlayer.lastName} ${rightPlayer.firstName}`,
        ],
      },
    });
    expect(notification.id).toContain("special-relationship");
    expect(notification.id).toContain("partner");
  });

  it("keeps only the newest special relationship notice while preserving other types", () => {
    const { state, left, right } = firstPair();
    const first = buildSpecialRelationshipNotification({
      state,
      transition: {
        action: "established",
        kind: "rival",
        playerIds: [left, right].sort() as [typeof left, typeof right],
      },
    });
    const newerState = {
      ...state,
      date: "2026-04-08" as GameDate,
      calendar: { ...state.calendar, weekOfYear: 2 },
    };
    const newest = buildSpecialRelationshipNotification({
      state: newerState,
      transition: {
        action: "removed",
        kind: "rival",
        playerIds: [left, right].sort() as [typeof left, typeof right],
      },
    });
    const unrelated = {
      id: "training-fixture",
      type: "training-result",
      createdGameDate: state.date,
      academicYearIndex: state.yearIndex,
      weekOfYear: 1,
      readAtGameDate: null,
      payload: {
        teamTrainingMenuName: "基礎練習",
        totalAbilityGrowth: 0,
        totalFatigueChange: 0,
        injuredCount: 0,
        players: [],
      },
    } as const;

    const withFirst = appendNotification({ items: [unrelated] }, first);
    const next = appendNotification(withFirst, newest);

    expect(next.items).toContain(unrelated);
    expect(
      next.items.filter((item) => item.type === "special-relationship"),
    ).toEqual([newest]);
    expect(selectHomeSpecialRelationshipNotifications(next)).toEqual([newest]);
  });
});
