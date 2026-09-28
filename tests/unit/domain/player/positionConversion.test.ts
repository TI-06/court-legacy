import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  cancelPositionConversion,
  positionConversionWeeks,
  progressPositionConversions,
  startPositionConversion,
} from "../../../../src/domain/player/positionConversion";

describe("position conversion", () => {
  it("takes fewer weeks when target aptitude is already high", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const target = player.preferredPosition === "S" ? "OH" : "S";

    player.positionAptitudes[target] = 72;
    expect(positionConversionWeeks(player, target)).toBe(3);

    player.positionAptitudes[target] = 35;
    expect(positionConversionWeeks(player, target)).toBe(7);
  });

  it("shortens conversion specialists by one week", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const target = player.preferredPosition === "MB" ? "OH" : "MB";
    player.positionAptitudes[target] = 50;

    expect(positionConversionWeeks(player, target)).toBe(5);
    player.growthTypeId = "growth.conversion";
    expect(positionConversionWeeks(player, target)).toBe(4);
  });

  it("raises target aptitude weekly and changes the preferred position only on completion", () => {
    let state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const original = player.preferredPosition;
    const target = original === "S" ? "OH" : "S";
    player.positionAptitudes[target] = 60;

    state = startPositionConversion(state, playerId, target);
    expect(state.players[playerId]!.preferredPosition).toBe(original);
    expect(state.players[playerId]!.positionConversion).toMatchObject({
      fromPosition: original,
      targetPosition: target,
      totalWeeks: 4,
      remainingWeeks: 4,
    });

    const afterOne = progressPositionConversions(state);
    expect(afterOne.state.players[playerId]!.preferredPosition).toBe(original);
    expect(
      afterOne.state.players[playerId]!.positionAptitudes[target],
    ).toBeGreaterThan(60);
    expect(
      afterOne.state.players[playerId]!.positionConversion?.remainingWeeks,
    ).toBe(3);

    let progressed = afterOne.state;
    for (let week = 0; week < 3; week += 1) {
      progressed = progressPositionConversions(progressed).state;
    }

    expect(progressed.players[playerId]!.preferredPosition).toBe(target);
    expect(
      progressed.players[playerId]!.positionAptitudes[target],
    ).toBeGreaterThanOrEqual(70);
    expect(progressed.players[playerId]!.positionConversion).toBeUndefined();
  });

  it("can cancel a conversion without changing the current position", () => {
    let state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const original = state.players[playerId]!.preferredPosition;
    const target = original === "L" ? "OH" : "L";

    state = startPositionConversion(state, playerId, target);
    state = cancelPositionConversion(state, playerId);

    expect(state.players[playerId]!.preferredPosition).toBe(original);
    expect(state.players[playerId]!.positionConversion).toBeUndefined();
  });
});
