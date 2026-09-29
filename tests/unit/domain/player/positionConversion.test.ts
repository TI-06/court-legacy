import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import {
  positionConversionWeeks,
  progressPositionConversions,
  startPositionConversion,
} from "../../../../src/domain/player/positionConversion";

function fixture() {
  const state = createInitialGame({
    seed: "phase46-position-conversion",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高橋 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
  const school = state.schools[state.userSchoolId]!;
  const playerId = school.playerIds[0]!;
  return { state, playerId };
}

describe("Phase46 position conversion", () => {
  it("uses current target aptitude to determine a multi-week conversion", () => {
    const { state, playerId } = fixture();
    const player = state.players[playerId]!;
    state.players[playerId] = {
      ...player,
      preferredPosition: "OH",
      growthTypeId: "growth.standard",
      positionAptitudes: {
        ...player.positionAptitudes,
        S: 45,
      },
    };

    expect(positionConversionWeeks(state.players[playerId]!, "S")).toBe(6);

    const started = startPositionConversion(state, playerId, "S");
    expect(started.players[playerId]!.preferredPosition).toBe("OH");
    expect(started.players[playerId]!.positionConversion).toMatchObject({
      fromPosition: "OH",
      targetPosition: "S",
      totalWeeks: 6,
      remainingWeeks: 6,
    });
  });

  it("shortens conversion for conversion-type players", () => {
    const { state, playerId } = fixture();
    const player = state.players[playerId]!;
    const conversionPlayer = {
      ...player,
      preferredPosition: "OH" as const,
      growthTypeId: "growth.conversion",
      positionAptitudes: {
        ...player.positionAptitudes,
        S: 45,
      },
    };

    expect(positionConversionWeeks(conversionPlayer, "S")).toBe(4);
  });

  it("raises target aptitude weekly and changes the preferred position on completion", () => {
    const { state, playerId } = fixture();
    const player = state.players[playerId]!;
    let current = startPositionConversion(
      {
        ...state,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            preferredPosition: "OH",
            growthTypeId: "growth.standard",
            positionAptitudes: {
              ...player.positionAptitudes,
              S: 72,
            },
          },
        },
      },
      playerId,
      "S",
    );

    expect(current.players[playerId]!.positionConversion?.totalWeeks).toBe(3);

    for (let week = 0; week < 2; week += 1) {
      current = progressPositionConversions(current).state;
      expect(current.players[playerId]!.preferredPosition).toBe("OH");
      expect(current.players[playerId]!.positionConversion).toBeDefined();
    }

    current = progressPositionConversions(current).state;
    expect(current.players[playerId]!.preferredPosition).toBe("S");
    expect(current.players[playerId]!.positionConversion).toBeUndefined();
    expect(
      current.players[playerId]!.positionAptitudes.S,
    ).toBeGreaterThanOrEqual(72);
  });
});
