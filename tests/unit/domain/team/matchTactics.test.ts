import { describe, expect, it } from "vitest";
import type { TeamTactics } from "../../../../src/domain/model/School";
import { playerId } from "../../../../src/domain/model/identifiers";
import {
  applyMatchTacticPlan,
  deriveMatchTacticPlan,
  getAttackBlockMatchupPoints,
  summarizeTacticMatchup,
} from "../../../../src/domain/team/matchTactics";

function tactics(overrides: Partial<TeamTactics> = {}): TeamTactics {
  return {
    serveRisk: 50,
    serveTargetPlayerId: playerId("target-player"),
    attackTempo: "balanced",
    attackDistribution: {
      OH: 40,
      MB: 22,
      OP: 34,
      S: 4,
      L: 0,
    },
    blockSystem: "mixed",
    defenseBias: "line",
    ...overrides,
  };
}

describe("deriveMatchTacticPlan", () => {
  it.each([
    [39, "safe"],
    [40, "balanced"],
    [60, "balanced"],
    [61, "aggressive"],
  ] as const)("maps serveRisk %s to %s", (serveRisk, expected) => {
    expect(deriveMatchTacticPlan(tactics({ serveRisk })).serve).toBe(expected);
  });

  it.each([
    ["slow", "side"],
    ["balanced", "balanced"],
    ["fast", "quick"],
  ] as const)("maps attackTempo %s to %s", (attackTempo, expected) => {
    expect(deriveMatchTacticPlan(tactics({ attackTempo })).attack).toBe(
      expected,
    );
  });

  it.each(["commit", "mixed", "read"] as const)(
    "keeps block system %s categorical",
    (blockSystem) => {
      expect(deriveMatchTacticPlan(tactics({ blockSystem })).block).toBe(
        blockSystem,
      );
    },
  );
});

describe("applyMatchTacticPlan", () => {
  it.each([
    ["safe", 25],
    ["balanced", 50],
    ["aggressive", 75],
  ] as const)("writes canonical serve plan %s", (serve, serveRisk) => {
    const source = tactics();
    const next = applyMatchTacticPlan(source, {
      serve,
      attack: "balanced",
      block: "mixed",
    });

    expect(next.serveRisk).toBe(serveRisk);
    expect(next.serveTargetPlayerId).toBe(source.serveTargetPlayerId);
    expect(next.defenseBias).toBe("line");
    expect(source.serveRisk).toBe(50);
  });

  it.each([
    ["side", "slow", { OH: 45, MB: 15, OP: 36, S: 4, L: 0 }],
    ["balanced", "balanced", { OH: 40, MB: 22, OP: 34, S: 4, L: 0 }],
    ["quick", "fast", { OH: 34, MB: 32, OP: 30, S: 4, L: 0 }],
  ] as const)(
    "writes canonical attack plan %s",
    (attack, attackTempo, attackDistribution) => {
      const next = applyMatchTacticPlan(tactics(), {
        serve: "balanced",
        attack,
        block: "read",
      });

      expect(next.attackTempo).toBe(attackTempo);
      expect(next.attackDistribution).toEqual(attackDistribution);
      expect(
        Object.values(next.attackDistribution).reduce((a, b) => a + b, 0),
      ).toBe(100);
      expect(next.blockSystem).toBe("read");
    },
  );

  it("returns a new tactics object without mutating compatibility-only fields", () => {
    const source = tactics();
    const sourceDistribution = source.attackDistribution;
    const next = applyMatchTacticPlan(source, {
      serve: "aggressive",
      attack: "quick",
      block: "commit",
    });

    expect(next).not.toBe(source);
    expect(next.attackDistribution).not.toBe(sourceDistribution);
    expect(next.serveTargetPlayerId).toBe(source.serveTargetPlayerId);
    expect(next.defenseBias).toBe(source.defenseBias);
    expect(source).toEqual(tactics());
  });
});

describe("attack/block matchup", () => {
  it.each([
    ["side", "commit", 3],
    ["side", "mixed", 0],
    ["side", "read", -3],
    ["balanced", "commit", 0],
    ["balanced", "mixed", 0],
    ["balanced", "read", 0],
    ["quick", "commit", -3],
    ["quick", "mixed", 0],
    ["quick", "read", 3],
  ] as const)(
    "scores %s attack vs %s block as %s",
    (attack, block, expected) => {
      expect(getAttackBlockMatchupPoints(attack, block)).toBe(expected);
    },
  );

  it("summarizes both teams using only categorical tactics", () => {
    expect(
      summarizeTacticMatchup(
        { serve: "aggressive", attack: "quick", block: "commit" },
        { serve: "safe", attack: "quick", block: "read" },
      ),
    ).toEqual({
      ownAttack: "favorable",
      ownBlock: "favorable",
      headline: "favorable",
    });
  });

  it("reports a split matchup as neutral overall", () => {
    expect(
      summarizeTacticMatchup(
        { serve: "balanced", attack: "quick", block: "read" },
        { serve: "balanced", attack: "side", block: "read" },
      ),
    ).toEqual({
      ownAttack: "favorable",
      ownBlock: "unfavorable",
      headline: "neutral",
    });
  });
});
