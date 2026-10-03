import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";

describe("Phase56 weekly team identity progression", () => {
  it("advances mastery exactly once when the game week advances", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    state.teamPlanning.teamIdentity = {
      style: "serve-block",
      mastery: 40,
      weeksInStyle: 2,
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

    expect(result.state.teamPlanning.teamIdentity).toMatchObject({
      style: "serve-block",
      mastery: 45,
      weeksInStyle: 3,
      changeCount: 1,
    });
    expect(state.teamPlanning.teamIdentity).toMatchObject({
      mastery: 40,
      weeksInStyle: 2,
    });
  });

  it("materializes a compatible default for a legacy save on first week advance", () => {
    const state = createDemoGame();
    delete state.teamPlanning.teamIdentity;

    const result = advanceGameWeek(state, gameData);

    expect(result.state.teamPlanning.teamIdentity).toMatchObject({
      style: "balanced",
      weeksInStyle: 1,
      changeCount: 0,
    });
    expect(
      result.state.teamPlanning.teamIdentity?.mastery,
    ).toBeGreaterThanOrEqual(52);
  });
});
