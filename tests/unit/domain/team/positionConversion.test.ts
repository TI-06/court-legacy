import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import {
  progressPositionConversionsWeekly,
  startPositionConversion,
} from "../../../../src/domain/team/teamPlanning";

function createState() {
  return createInitialGame({
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
}

describe("Phase46 position conversion", () => {
  it("progresses aptitude each week and changes the preferred position only on completion", () => {
    let state = createState();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const player = state.players[playerId]!;
    const originalPosition = player.preferredPosition;
    const targetPosition = originalPosition === "S" ? "OH" : "S";

    state.players[playerId] = {
      ...player,
      growthTypeId: "growth.standard",
      positionAptitudes: {
        ...player.positionAptitudes,
        [targetPosition]: 50,
      },
    };

    state = startPositionConversion(state, playerId, targetPosition);
    const plan = state.teamPlanning.positionConversionsByPlayerId?.[playerId];
    expect(plan?.weeksRequired).toBe(5);

    state = progressPositionConversionsWeekly(state);
    expect(state.players[playerId]!.preferredPosition).toBe(originalPosition);
    expect(
      state.players[playerId]!.positionAptitudes[targetPosition],
    ).toBeGreaterThan(50);

    for (let week = 1; week < 5; week += 1) {
      state = progressPositionConversionsWeekly(state);
    }

    expect(state.players[playerId]!.preferredPosition).toBe(targetPosition);
    expect(
      state.players[playerId]!.positionAptitudes[targetPosition],
    ).toBeGreaterThanOrEqual(75);
    expect(
      state.teamPlanning.positionConversionsByPlayerId?.[playerId],
    ).toBeUndefined();
  });

  it("lets conversion-growth players finish faster", () => {
    let state = createState();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const targetPosition = player.preferredPosition === "MB" ? "OH" : "MB";

    state.players[playerId] = {
      ...player,
      growthTypeId: "growth.conversion",
      positionAptitudes: {
        ...player.positionAptitudes,
        [targetPosition]: 40,
      },
    };

    state = startPositionConversion(state, playerId, targetPosition);
    expect(
      state.teamPlanning.positionConversionsByPlayerId?.[playerId]
        ?.weeksRequired,
    ).toBe(4);
  });
});
