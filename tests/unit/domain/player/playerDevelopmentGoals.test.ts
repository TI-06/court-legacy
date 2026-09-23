import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  getPlayerDevelopmentGoalProgress,
  nextDevelopmentTargetGrade,
  playerDevelopmentAreaValue,
} from "../../../../src/domain/player/playerDevelopmentGoals";
import { ratingToGrade } from "../../../../src/domain/selectors/ratingGrades";

describe("playerDevelopmentGoals", () => {
  it("targets the next visible grade for the selected grouped ability", () => {
    const state = createDemoGame();
    const player =
      state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;
    const current = ratingToGrade(playerDevelopmentAreaValue(player, "attack"));
    const target = nextDevelopmentTargetGrade(player, "attack");

    expect(["S", "A", "B", "C", "D", "E", "F", "G"]).toContain(target);
    if (current !== "S") {
      expect(target).not.toBe(current);
    }
  });

  it("targets S after A and keeps S as the ceiling", () => {
    const state = createDemoGame();
    const player =
      state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;

    player.abilities.jump = 85;
    expect(nextDevelopmentTargetGrade(player, "jump")).toBe("S");

    player.abilities.jump = 95;
    expect(nextDevelopmentTargetGrade(player, "jump")).toBe("S");
  });

  it("marks a goal achieved when the current grade reaches the target grade", () => {
    const state = createDemoGame();
    const player =
      state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;
    player.abilities.jump = 82;

    expect(
      getPlayerDevelopmentGoalProgress(player, {
        area: "jump",
        targetGrade: "B",
      }),
    ).toMatchObject({
      areaLabel: "跳躍",
      currentGrade: "A",
      targetGrade: "B",
      achieved: true,
    });
  });
});
