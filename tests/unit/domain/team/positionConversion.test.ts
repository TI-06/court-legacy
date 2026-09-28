import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  buildPositionConversion,
  progressPositionConversions,
  startPositionConversion,
} from "../../../../src/domain/team/positionConversion";

describe("Phase46 position conversion", () => {
  it("uses current aptitude to determine a multi-week conversion plan", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;
    player.preferredPosition = "OH";
    player.positionAptitudes.S = 52;

    const plan = buildPositionConversion(state, player.id, "S");

    expect(plan.fromPosition).toBe("OH");
    expect(plan.targetPosition).toBe("S");
    expect(plan.totalWeeks).toBe(5);
    expect(plan.completedWeeks).toBe(0);
  });

  it("shortens the plan for conversion growth types", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;
    player.preferredPosition = "OH";
    player.positionAptitudes.S = 52;
    player.growthTypeId = "growth.conversion";

    expect(buildPositionConversion(state, player.id, "S").totalWeeks).toBe(4);
  });

  it("raises target aptitude weekly and changes preferred position only on completion", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const player = state.players[playerId]!;
    player.preferredPosition = "OH";
    player.positionAptitudes.S = 60;

    let current = startPositionConversion(state, playerId, "S");
    const plan = current.teamPlanning.positionConversionsByPlayerId?.[playerId];
    expect(plan?.totalWeeks).toBe(4);

    for (let week = 1; week < 4; week += 1) {
      const progressed = progressPositionConversions(current);
      current = progressed.state;
      expect(current.players[playerId]!.preferredPosition).toBe("OH");
      expect(
        current.teamPlanning.positionConversionsByPlayerId?.[playerId]
          ?.completedWeeks,
      ).toBe(week);
      expect(current.players[playerId]!.positionAptitudes.S).toBeGreaterThan(
        60,
      );
      expect(progressed.completions).toHaveLength(0);
    }

    const completed = progressPositionConversions(current);
    expect(completed.state.players[playerId]!.preferredPosition).toBe("S");
    expect(completed.state.players[playerId]!.positionAptitudes.S).toBe(70);
    expect(
      completed.state.teamPlanning.positionConversionsByPlayerId?.[playerId],
    ).toBeUndefined();
    expect(completed.completions).toEqual([
      expect.objectContaining({
        playerId,
        fromPosition: "OH",
        targetPosition: "S",
        finalAptitude: 70,
      }),
    ]);
  });
});
