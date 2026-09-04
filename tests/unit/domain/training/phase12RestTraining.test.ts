import { describe, expect, it } from "vitest";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import type {
  RandomSnapshot,
  RandomSource,
} from "../../../../src/domain/random/SeededRandom";
import { resolveWeeklyTraining } from "../../../../src/domain/training/resolveWeeklyTraining";
if (!gameDataBootstrap.ok) throw new Error(gameDataBootstrap.message);
const data = gameDataBootstrap.data;
const userSchool = {
  name: "蒼波高校",
  shortName: "蒼波",
  regionId: "region.test",
  coachName: "高城 監督",
  uniform: { primary: "#173B52", secondary: "#F4F7F8", accent: "#D89A2B" },
};
class MiddleRandom implements RandomSource {
  #cursor = 0;
  get cursor() {
    return this.#cursor;
  }
  next() {
    this.#cursor += 1;
    return 0.5;
  }
  int(min: number, max: number) {
    this.#cursor += 1;
    return Math.round((min + max) / 2);
  }
  pick<T>(items: readonly T[]) {
    return items[0]!;
  }
  fork() {
    return new MiddleRandom();
  }
  snapshot(): RandomSnapshot {
    return { seed: "middle", cursor: this.#cursor };
  }
}
describe("Phase 12 rest training", () => {
  it("raises condition by 25, leaves fatigue unchanged and adds no ability growth", () => {
    const state = generateWorld({ seed: "phase12-rest", userSchool, data });
    const school = state.schools[state.userSchoolId]!;
    const id = school.playerIds[0]!;
    state.players[id] = { ...state.players[id]!, condition: 50, fatigue: 88 };
    const before = structuredClone(state.players[id]!);
    const result = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: {
        teamTrainingMenuId: "training.spike",
        individualAssignments: [
          { playerId: id, instructionId: "instruction.rest" },
        ],
      },
      data,
      random: new MiddleRandom(),
    });
    const after = result.state.players[id]!;
    const log = result.result.playerLogs.find((item) => item.playerId === id)!;
    expect(after.condition).toBe(75);
    expect(after.fatigue).toBe(88);
    expect(after.abilities).toEqual(before.abilities);
    expect(log.totalAbilityGrowth).toBe(0);
    expect(log.fatigueChange).toBe(0);
  });
});
