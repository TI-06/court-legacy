import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  progressPositionConversions,
  startPositionConversion,
} from "../../../../src/domain/player/positionConversion";

describe("position conversion", () => {
  it("progresses over multiple weeks and changes the preferred position only on completion", () => {
    let state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const player = state.players[playerId]!;
    const target = player.preferredPosition === "S" ? "OH" : "S";

    state.players[playerId] = {
      ...player,
      positionAptitudes: {
        ...player.positionAptitudes,
        [target]: 50,
      },
    };

    state = startPositionConversion(state, playerId, target);
    expect(state.players[playerId]!.positionConversion?.totalWeeks).toBe(5);
    expect(state.players[playerId]!.preferredPosition).toBe(
      player.preferredPosition,
    );

    for (let week = 0; week < 4; week += 1) {
      state = progressPositionConversions(state).state;
      expect(state.players[playerId]!.preferredPosition).toBe(
        player.preferredPosition,
      );
    }

    const beforeFinal = state.players[playerId]!;
    expect(beforeFinal.positionConversion?.remainingWeeks).toBe(1);
    expect(beforeFinal.positionAptitudes[target]).toBeGreaterThan(50);

    state = progressPositionConversions(state).state;
    expect(state.players[playerId]!.preferredPosition).toBe(target);
    expect(state.players[playerId]!.positionConversion).toBeUndefined();
    expect(state.players[playerId]!.positionAptitudes[target]).toBeGreaterThanOrEqual(
      70,
    );
  });

  it("shortens conversion by one week for growth.conversion players", () => {
    let state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const player = state.players[playerId]!;
    const target = player.preferredPosition === "MB" ? "OH" : "MB";

    state.players[playerId] = {
      ...player,
      growthTypeId: "growth.conversion",
      positionAptitudes: {
        ...player.positionAptitudes,
        [target]: 40,
      },
    };

    state = startPositionConversion(state, playerId, target);
    expect(state.players[playerId]!.positionConversion?.totalWeeks).toBe(5);
  });
});
