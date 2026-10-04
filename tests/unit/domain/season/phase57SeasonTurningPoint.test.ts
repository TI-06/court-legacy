import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  resolveSeasonTurningPoint,
  selectSeasonTurningPoint,
} from "../../../../src/domain/season/seasonTurningPoint";

describe("Phase57 season turning points", () => {
  it("surfaces one opening direction decision and records it once", () => {
    const state = createDemoGame();
    state.calendar.weekOfYear = 2;
    state.calendar.completedActivityIds = [];

    const turningPoint = selectSeasonTurningPoint(state);

    expect(turningPoint).toMatchObject({
      id: "season-direction",
    });
    expect(turningPoint?.choices).toHaveLength(2);

    const firstYear = state.schools[state.userSchoolId]!.playerIds
      .map((playerId) => state.players[playerId]!)
      .find((player) => player.grade === 1);
    if (!firstYear) throw new Error("first-year fixture missing");

    const beforeTrust = firstYear.trust;
    const resolved = resolveSeasonTurningPoint(
      state,
      "season-direction",
      "build-future",
    );

    expect(resolved.players[firstYear.id]!.trust).toBe(
      Math.min(100, beforeTrust + 4),
    );
    expect(
      resolved.calendar.completedActivityIds.some((id) =>
        id.endsWith(":season-direction"),
      ),
    ).toBe(true);
    expect(selectSeasonTurningPoint(resolved)).toBeNull();
  });

  it("surfaces one camp pressure decision after the opening decision", () => {
    const state = createDemoGame();
    const camp = state.calendar.activities.find(
      (activity) =>
        activity.type === "camp" && Number(activity.metadata.campPhase) === 1,
    );
    if (!camp) throw new Error("camp fixture missing");

    state.date = camp.date;
    state.calendar.currentDate = camp.date;
    state.calendar.weekOfYear = Number(camp.metadata.weekOfYear);
    state.calendar.completedActivityIds = [
      `season-turning:${state.calendar.academicYear}:season-direction`,
    ];

    const turningPoint = selectSeasonTurningPoint(state);
    expect(turningPoint).toMatchObject({
      id: "pressure-moment",
      contextLabel: camp.title,
    });

    const beforeCondition =
      state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!.condition;
    const resolved = resolveSeasonTurningPoint(
      state,
      "pressure-moment",
      "recover",
    );

    expect(
      resolved.players[state.schools[state.userSchoolId]!.playerIds[0]!]!
        .condition,
    ).toBe(Math.min(100, beforeCondition + 5));
    expect(selectSeasonTurningPoint(resolved)).toBeNull();
  });

  it("rejects a choice that does not belong to the current decision", () => {
    const state = createDemoGame();
    state.calendar.weekOfYear = 2;
    state.calendar.completedActivityIds = [];

    expect(() =>
      resolveSeasonTurningPoint(state, "season-direction", "push"),
    ).toThrow("選択肢");
  });
});
