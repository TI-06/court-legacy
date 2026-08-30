import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { createInitialWeeklySchedule } from "../../../../src/domain/weekly/createWeeklySchedule";

describe("Phase 8 practice-match planning", () => {
  it("creates three unique deterministic outgoing candidates without consuming randomCursor", () => {
    const state = createDemoGame();
    const beforeCursor = state.randomCursor;

    const first = createInitialWeeklySchedule(state);
    const second = createInitialWeeklySchedule(state);

    expect(first.practiceMatch).toEqual(second.practiceMatch);
    expect(state.randomCursor).toBe(beforeCursor);
    expect(first.practiceMatch.outgoingCandidates).toHaveLength(3);
    expect(
      new Set(
        first.practiceMatch.outgoingCandidates.map(
          (candidate) => candidate.schoolId,
        ),
      ).size,
    ).toBe(3);
    expect(
      first.practiceMatch.outgoingCandidates.every(
        (candidate) => candidate.schoolId !== state.userSchoolId,
      ),
    ).toBe(true);
  });
});
