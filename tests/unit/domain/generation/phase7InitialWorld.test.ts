import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { createInitialTeamDynamics } from "../../../../src/domain/dynamics/createInitialTeamDynamics";
import type { TeamDynamicsState } from "../../../../src/domain/dynamics/teamDynamicsTypes";
import type { GameState } from "../../../../src/domain/model/GameState";

type Phase7GameState = GameState & { teamDynamics: TeamDynamicsState };

describe("Phase 7 initial world", () => {
  it("initializes bounded deterministic team dynamics for new games", () => {
    const first = createDemoGame() as Phase7GameState;
    const second = createDemoGame() as Phase7GameState;

    expect(first.schemaVersion).toBe(4);
    expect(first.teamDynamics).toEqual(second.teamDynamics);
    expect(first.teamDynamics.cohesion).toBeGreaterThanOrEqual(0);
    expect(first.teamDynamics.cohesion).toBeLessThanOrEqual(100);
    expect(first.teamDynamics.cohesionTrend).toBe("stable");
    expect(first.teamDynamics.recentOfficialMatchesTracked).toBe(0);
  });

  it("creates initial dynamics without mutating state or consuming random cursor", () => {
    const state = createDemoGame();
    const before = structuredClone(state);

    const dynamics = createInitialTeamDynamics(state);

    expect(state).toEqual(before);
    expect(state.randomCursor).toBe(before.randomCursor);
    expect(dynamics.cohesion).toBeGreaterThanOrEqual(0);
    expect(dynamics.cohesion).toBeLessThanOrEqual(100);
    expect(dynamics.playerRoles).toEqual({});
    expect(dynamics.playerConcerns).toEqual({});
  });
});
