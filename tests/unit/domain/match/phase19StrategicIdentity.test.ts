import { describe, expect, it } from "vitest";
import type { TeamTactics } from "../../../../src/domain/model/School";
import {
  applySchoolMatchIdentityDefaults,
  schoolMatchIdentity,
} from "../../../../src/domain/match/schoolMatchIdentity";

const baseTactics: TeamTactics = {
  serveRisk: 50,
  serveTargetPlayerId: null,
  attackTempo: "balanced",
  attackDistribution: { OH: 40, MB: 22, OP: 34, S: 4, L: 0 },
  blockSystem: "mixed",
  defenseBias: "balanced",
};

describe("Phase19-4 school strategic identities", () => {
  it("gives all eight archetypes recognizable tactical identities", () => {
    expect(schoolMatchIdentity("school.balanced").preferredPlan).toEqual({
      serve: "balanced",
      attack: "balanced",
      block: "mixed",
    });
    expect(schoolMatchIdentity("school.defense").defensePreference).toBe(
      "cross",
    );
    expect(schoolMatchIdentity("school.height").preferredPlan.block).toBe(
      "commit",
    );
    expect(schoolMatchIdentity("school.speed").preferredPlan.attack).toBe(
      "quick",
    );
    expect(schoolMatchIdentity("school.ace").attackDistributionBias.OH).toBeGreaterThan(
      schoolMatchIdentity("school.ace").attackDistributionBias.MB ?? 0,
    );
    expect(schoolMatchIdentity("school.serve").preferredPlan.serve).toBe(
      "aggressive",
    );
    expect(schoolMatchIdentity("school.development").adaptationBias).toBe(
      "hold-style",
    );
    const rotation = schoolMatchIdentity("school.rotation");
    expect(rotation.attackDistributionBias.OH).toBeGreaterThan(0);
    expect(rotation.attackDistributionBias.MB).toBeGreaterThan(0);
    expect(rotation.attackDistributionBias.OP).toBeGreaterThan(0);
  });

  it("applies identity defaults without mutating the input tactics", () => {
    const before = structuredClone(baseTactics);
    const speed = applySchoolMatchIdentityDefaults(baseTactics, "school.speed");

    expect(baseTactics).toEqual(before);
    expect(speed.attackTempo).toBe("fast");
    expect(speed.blockSystem).toBe("read");
  });

  it("keeps a serve school aggressive by default", () => {
    const serve = applySchoolMatchIdentityDefaults(baseTactics, "school.serve");

    expect(serve.serveRisk).toBeGreaterThanOrEqual(65);
    expect(serve.attackTempo).toBe("balanced");
  });

  it("keeps a height school committed to height and blocking identity", () => {
    const height = applySchoolMatchIdentityDefaults(baseTactics, "school.height");

    expect(height.attackTempo).toBe("slow");
    expect(height.blockSystem).toBe("commit");
  });
});
