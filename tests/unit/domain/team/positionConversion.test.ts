import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  cancelPositionConversion,
  positionConversionWeeks,
  progressPositionConversions,
  startPositionConversion,
} from "../../../../src/domain/team/positionConversion";

describe("Phase46 position conversion", () => {
  it("progresses aptitude weekly and changes the preferred position only when complete", () => {
    let state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const target = player.preferredPosition === "S" ? "OH" : "S";
    player.positionAptitudes[target] = 40;

    state = startPositionConversion(state, playerId, target);
    const plan = state.teamPlanning.positionConversionsByPlayerId?.[playerId];
    expect(plan?.weeksRequired).toBe(positionConversionWeeks(player, target));
    expect(plan?.weeksCompleted).toBe(0);
    expect(state.players[playerId]!.preferredPosition).toBe(
      player.preferredPosition,
    );

    for (let week = 1; week < plan!.weeksRequired; week += 1) {
      state = progressPositionConversions(state);
      expect(state.players[playerId]!.preferredPosition).toBe(
        player.preferredPosition,
      );
      expect(
        state.teamPlanning.positionConversionsByPlayerId?.[playerId]
          ?.weeksCompleted,
      ).toBe(week);
    }

    state = progressPositionConversions(state);
    expect(state.players[playerId]!.preferredPosition).toBe(target);
    expect(
      state.players[playerId]!.positionAptitudes[target],
    ).toBeGreaterThanOrEqual(70);
    expect(
      state.teamPlanning.positionConversionsByPlayerId?.[playerId],
    ).toBeUndefined();
  });

  it("shortens conversion for growth.conversion players and can be cancelled", () => {
    let state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const target = player.preferredPosition === "MB" ? "OP" : "MB";
    player.positionAptitudes[target] = 35;
    const normalWeeks = positionConversionWeeks(player, target);

    player.growthTypeId = "growth.conversion";
    expect(positionConversionWeeks(player, target)).toBe(
      Math.max(3, normalWeeks - 1),
    );

    state = startPositionConversion(state, playerId, target);
    state = cancelPositionConversion(state, playerId);
    expect(
      state.teamPlanning.positionConversionsByPlayerId?.[playerId],
    ).toBeUndefined();
    expect(state.players[playerId]!.preferredPosition).toBe(
      player.preferredPosition,
    );
  });
});
