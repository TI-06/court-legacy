import { describe, expect, it } from "vitest";
import type {
  CoachDecisionReason,
  MatchCommand,
  MatchRuntimeState,
} from "../../../../src/domain/model/Match";
import {
  resumeMatch,
  startMatch,
} from "../../../../src/domain/match/simulateMatch";

describe("Phase16 resumable match API", () => {
  it("exports the high-level resumable match contract", () => {
    const reason: CoachDecisionReason = "opponent-run";
    const command: MatchCommand = { type: "continue" };
    const runtime = null as unknown as MatchRuntimeState;

    expect(reason).toBe("opponent-run");
    expect(command.type).toBe("continue");
    expect(runtime).toBeNull();
    expect(startMatch).toBeTypeOf("function");
    expect(resumeMatch).toBeTypeOf("function");
  });
});
