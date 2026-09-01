import { describe, expect, it } from "vitest";
import { createDefaultWeeklyPlan } from "../../../../src/domain/weekly/createWeeklySchedule";

describe("Phase 12 default weekly plan", () => {
  it("assigns balanced training to every roster player", () => {
    const state = {
      userSchoolId: "school.user",
      schools: {
        "school.user": {
          playerIds: ["player.1", "player.2", "player.3"],
        },
      },
    } as Parameters<typeof createDefaultWeeklyPlan>[0];

    expect(createDefaultWeeklyPlan(state).individualAssignments).toEqual([
      { playerId: "player.1", instructionId: "instruction.overall" },
      { playerId: "player.2", instructionId: "instruction.overall" },
      { playerId: "player.3", instructionId: "instruction.overall" },
    ]);
  });
});
