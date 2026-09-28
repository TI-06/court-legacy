import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  cancelPlayerPositionConversion,
  progressPositionConversions,
  startPlayerPositionConversion,
} from "../../../../src/domain/team/positionConversion";

describe("position conversion", () => {
  it("requires multiple training weeks and preserves the old aptitude", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const fromPosition = player.preferredPosition;
    const targetPosition = fromPosition === "S" ? "OH" : "S";
    const oldAptitude = player.positionAptitudes[fromPosition];

    let current = startPlayerPositionConversion(state, playerId, targetPosition);
    const plan = current.teamPlanning.positionConversionsByPlayerId?.[playerId]!;
    expect(plan.requiredWeeks).toBeGreaterThanOrEqual(4);
    expect(plan.requiredWeeks).toBeLessThanOrEqual(10);

    for (let week = 0; week < plan.requiredWeeks - 1; week += 1) {
      current = progressPositionConversions(
        current,
        new Set([playerId]),
      ).state;
      expect(current.players[playerId]!.preferredPosition).toBe(fromPosition);
    }

    const completed = progressPositionConversions(
      current,
      new Set([playerId]),
    );
    expect(completed.completedPlayerIds).toEqual([playerId]);
    expect(completed.state.players[playerId]!.preferredPosition).toBe(
      targetPosition,
    );
    expect(
      completed.state.players[playerId]!.positionAptitudes[targetPosition],
    ).toBeGreaterThanOrEqual(70);
    expect(
      completed.state.players[playerId]!.positionAptitudes[fromPosition],
    ).toBe(oldAptitude);
    expect(
      completed.state.teamPlanning.positionConversionsByPlayerId?.[playerId],
    ).toBeUndefined();
  });

  it("shortens conversion for the dedicated conversion growth type", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const targetPosition = player.preferredPosition === "S" ? "OH" : "S";
    player.growthTypeId = "growth.conversion";
    player.positionAptitudes[targetPosition] = 40;

    const started = startPlayerPositionConversion(
      state,
      playerId,
      targetPosition,
    );
    const plan =
      started.teamPlanning.positionConversionsByPlayerId?.[playerId]!;

    expect(plan.requiredWeeks).toBe(4);
  });

  it("does not progress on a week where the player did not train", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const targetPosition = player.preferredPosition === "L" ? "OH" : "L";
    const started = startPlayerPositionConversion(
      state,
      playerId,
      targetPosition,
    );

    const result = progressPositionConversions(started, new Set());

    expect(
      result.state.teamPlanning.positionConversionsByPlayerId?.[playerId]
        ?.completedWeeks,
    ).toBe(0);
    expect(result.progressedPlayerIds).toEqual([]);
  });

  it("can cancel without changing the player's current position", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const targetPosition = player.preferredPosition === "MB" ? "OH" : "MB";
    const started = startPlayerPositionConversion(
      state,
      playerId,
      targetPosition,
    );

    const cancelled = cancelPlayerPositionConversion(started, playerId);

    expect(
      cancelled.teamPlanning.positionConversionsByPlayerId?.[playerId],
    ).toBeUndefined();
    expect(cancelled.players[playerId]!.preferredPosition).toBe(
      player.preferredPosition,
    );
  });
});
