import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  positionConversionWeeks,
  progressPositionConversions,
  startPositionConversion,
} from "../../../../src/domain/player/positionConversion";

describe("position conversion", () => {
  it("takes 3-8 weeks from current aptitude and switches preferred position on completion", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const target = player.preferredPosition === "S" ? "OH" : "S";

    state.players[playerId] = {
      ...player,
      positionAptitudes: {
        ...player.positionAptitudes,
        [target]: 40,
      },
      growthTypeId: "growth.standard",
    };

    const weeks = positionConversionWeeks(state.players[playerId]!, target);
    expect(weeks).toBe(6);

    let current = startPositionConversion(state, playerId, target);
    expect(current.players[playerId]!.positionConversion?.weeksRemaining).toBe(
      6,
    );

    for (let index = 0; index < 5; index += 1) {
      const progressed = progressPositionConversions(current);
      current = progressed.state;
      expect(progressed.completions).toHaveLength(0);
    }

    const final = progressPositionConversions(current);
    expect(final.completions).toEqual([
      {
        playerId,
        fromPosition: player.preferredPosition,
        targetPosition: target,
      },
    ]);
    expect(final.state.players[playerId]!.preferredPosition).toBe(target);
    expect(final.state.players[playerId]!.positionConversion).toBeUndefined();
    expect(final.state.players[playerId]!.positionAptitudes[target]).toBeGreaterThanOrEqual(
      70,
    );
  });

  it("shortens conversion-trained players by one week without going below three", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const target = player.preferredPosition === "L" ? "OH" : "L";
    const base = {
      ...player,
      positionAptitudes: {
        ...player.positionAptitudes,
        [target]: 50,
      },
      growthTypeId: "growth.standard",
    };
    const specialist = {
      ...base,
      growthTypeId: "growth.conversion",
    };

    expect(positionConversionWeeks(base, target)).toBe(5);
    expect(positionConversionWeeks(specialist, target)).toBe(4);
  });
});
