import { describe, expect, it } from "vitest";
import {
  createDemoGame,
  gameData,
} from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";

describe("Phase56 weekly team identity progression", () => {
  it("advances team identity mastery exactly once per completed game week", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    state.teamPlanning.teamIdentity = {
      style: "serve-block",
      mastery: 40,
      weeksInStyle: 3,
      changeCount: 1,
    };
    school.tactics = {
      ...school.tactics,
      serveRisk: 75,
      attackTempo: "balanced",
      blockSystem: "commit",
      defenseBias: "balanced",
    };

    const result = advanceGameWeek(state, gameData);

    expect(result.state.teamPlanning.teamIdentity).toEqual({
      style: "serve-block",
      mastery: 45,
      weeksInStyle: 4,
      changeCount: 1,
    });
    expect(state.teamPlanning.teamIdentity).toEqual({
      style: "serve-block",
      mastery: 40,
      weeksInStyle: 3,
      changeCount: 1,
    });
  });

  it("materializes a safe balanced identity for a legacy save on week advance", () => {
    const state = createDemoGame();
    delete state.teamPlanning.teamIdentity;

    const result = advanceGameWeek(state, gameData);
    const identity = result.state.teamPlanning.teamIdentity;

    expect(identity).toBeDefined();
    expect(identity?.style).toBe("balanced");
    expect(identity?.weeksInStyle).toBe(1);
    expect(identity?.mastery).toBeGreaterThanOrEqual(52);
    expect(identity?.mastery).toBeLessThanOrEqual(55);
    expect(state.teamPlanning.teamIdentity).toBeUndefined();
  });
});
