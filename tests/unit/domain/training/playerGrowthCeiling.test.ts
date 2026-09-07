import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { resolvePlayerTrainingActivity } from "../../../../src/domain/training/resolveWeeklyTraining";

function trainSpike(ability: number, potential: number, tier: "normal" | "monster") {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const id = school.playerIds[0]!;
  const player = structuredClone(state.players[id]!);
  player.abilities.spike = ability;
  player.potential = potential;
  player.tier = tier;
  player.grade = 2;
  player.growthPeakGrade = 2;
  player.injury = null;

  return resolvePlayerTrainingActivity({
    player,
    school,
    data: gameData,
    random: new SeededRandom(`growth-ceiling:${ability}:${potential}:${tier}`),
    activity: {
      targetAbilities: ["spike"],
      baseGrowth: 40,
      fatigue: 0,
      injuryRisk: 0,
      trustGrowth: 0,
    },
  }).player.abilities.spike;
}

describe("long-term player growth ceiling", () => {
  it("stops an ordinary mid-potential player from grinding a 95 ability to 100", () => {
    expect(trainSpike(95, 50, "normal")).toBe(95);
  });

  it("still lets the same ordinary player develop normally before the elite range", () => {
    expect(trainSpike(70, 50, "normal")).toBeGreaterThan(70);
  });

  it("keeps the high-90s reachable for exceptional high-potential talent", () => {
    expect(trainSpike(95, 100, "monster")).toBeGreaterThan(95);
  });
});
