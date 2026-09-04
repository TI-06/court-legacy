import { describe, expect, it } from "vitest";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import { selectAutomaticRest } from "../../../../src/domain/weekly/autoRest";
if (!gameDataBootstrap.ok) throw new Error(gameDataBootstrap.message);
const data = gameDataBootstrap.data;
const userSchool = {
  name: "蒼波高校",
  shortName: "蒼波",
  regionId: "region.test",
  coachName: "高城 監督",
  uniform: { primary: "#173B52", secondary: "#F4F7F8", accent: "#D89A2B" },
};
describe("Phase 12 auto rest", () => {
  it("does not auto-rest healthy players for fatigue or poor condition", () => {
    const state = generateWorld({
      seed: "phase12-auto-rest",
      userSchool,
      data,
    });
    const school = state.schools[state.userSchoolId]!;
    const id = school.playerIds[0]!;
    state.players[id] = {
      ...state.players[id]!,
      fatigue: 100,
      condition: 0,
      injury: null,
    };
    expect(
      selectAutomaticRest(state, state.userSchoolId).some(
        (item) => item.playerId === id,
      ),
    ).toBe(false);
  });
});
