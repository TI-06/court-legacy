import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  positionConversionWeeks,
  progressPositionConversions,
  startPositionConversion,
} from "../../../../src/domain/player/positionConversion";

describe("Phase46 position conversion", () => {
  it("uses current aptitude to determine a 3-8 week conversion plan", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    player.positionAptitudes.S = 55;

    expect(positionConversionWeeks(player, "S")).toBe(5);

    player.positionAptitudes.S = 72;
    expect(positionConversionWeeks(player, "S")).toBe(3);
  });

  it("shortens conversion types by one week without going below three weeks", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    player.growthTypeId = "growth.conversion";
    player.positionAptitudes.S = 72;

    expect(positionConversionWeeks(player, "S")).toBe(3);
  });

  it("raises target aptitude weekly and switches preferred position only on completion", () => {
    let state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const originalPosition = state.players[playerId]!.preferredPosition;
    const target = originalPosition === "S" ? "OH" : "S";
    state.players[playerId]!.positionAptitudes[target] = 70;

    state = startPositionConversion(state, playerId, target);
    expect(state.players[playerId]!.positionConversion?.remainingWeeks).toBe(3);
    expect(state.players[playerId]!.preferredPosition).toBe(originalPosition);

    state = progressPositionConversions(state).state;
    expect(state.players[playerId]!.positionConversion?.remainingWeeks).toBe(2);
    expect(state.players[playerId]!.preferredPosition).toBe(originalPosition);

    state = progressPositionConversions(state).state;
    state = progressPositionConversions(state).state;

    expect(state.players[playerId]!.positionConversion).toBeUndefined();
    expect(state.players[playerId]!.preferredPosition).toBe(target);
    expect(
      state.players[playerId]!.positionAptitudes[target],
    ).toBeGreaterThanOrEqual(70);
  });

  it("rejects converting to the current position", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;

    expect(() =>
      startPositionConversion(state, playerId, player.preferredPosition),
    ).toThrow("現在と同じポジションには転向できません");
  });
});
