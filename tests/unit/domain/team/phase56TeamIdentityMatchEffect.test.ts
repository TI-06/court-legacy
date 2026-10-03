import { describe, expect, it } from "vitest";
import {
  calculateTeamIdentityExecutionBonus,
  type TeamIdentityExecutionPhase,
} from "../../../../src/domain/team/teamIdentity";
import type {
  TeamIdentityState,
  TeamIdentityStyle,
} from "../../../../src/domain/team/teamPlanningTypes";
import type { MatchTacticPlan } from "../../../../src/domain/team/matchTactics";

function identity(
  style: TeamIdentityStyle,
  mastery: number,
): TeamIdentityState {
  return {
    style,
    mastery,
    weeksInStyle: 20,
    changeCount: 0,
  };
}

const alignedPlans: Record<TeamIdentityStyle, MatchTacticPlan> = {
  "quick-combination": {
    serve: "balanced",
    attack: "quick",
    block: "mixed",
  },
  "serve-block": {
    serve: "aggressive",
    attack: "balanced",
    block: "commit",
  },
  "defense-rally": {
    serve: "safe",
    attack: "balanced",
    block: "read",
  },
  "ace-centered": {
    serve: "balanced",
    attack: "side",
    block: "mixed",
  },
  balanced: {
    serve: "balanced",
    attack: "balanced",
    block: "mixed",
  },
};

function bonus(
  style: TeamIdentityStyle,
  mastery: number,
  phase: TeamIdentityExecutionPhase,
): number {
  return calculateTeamIdentityExecutionBonus(
    identity(style, mastery),
    alignedPlans[style],
    "balanced",
    phase,
  );
}

describe("Phase56 team identity match effect", () => {
  it("keeps immature identities match-neutral", () => {
    expect(bonus("serve-block", 29, "serve")).toBe(0);
    expect(bonus("quick-combination", 29, "attack")).toBe(0);
  });

  it("caps specialist execution bonuses at two points", () => {
    expect(bonus("serve-block", 100, "serve")).toBe(2);
    expect(bonus("serve-block", 100, "block")).toBe(2);
    expect(bonus("quick-combination", 100, "set")).toBe(2);
    expect(bonus("quick-combination", 100, "attack")).toBe(2);
    expect(bonus("ace-centered", 100, "attack")).toBe(2);
  });

  it("does not boost unrelated phases for specialist identities", () => {
    expect(bonus("serve-block", 100, "attack")).toBe(0);
    expect(bonus("defense-rally", 100, "serve")).toBe(0);
    expect(bonus("ace-centered", 100, "receive")).toBe(0);
  });

  it("keeps the balanced identity broad but weaker per phase", () => {
    const phases: TeamIdentityExecutionPhase[] = [
      "serve",
      "receive",
      "set",
      "attack",
      "block",
      "dig",
    ];

    for (const phase of phases) {
      expect(bonus("balanced", 100, phase)).toBe(0.8);
    }
  });

  it("scales mastery gradually instead of jumping at a tier boundary", () => {
    expect(bonus("serve-block", 30, "serve")).toBe(0);
    expect(bonus("serve-block", 45, "serve")).toBe(0.6);
    expect(bonus("serve-block", 60, "serve")).toBe(1.2);
    expect(bonus("serve-block", 85, "serve")).toBe(1.7);
    expect(bonus("serve-block", 100, "serve")).toBe(2);
  });

  it("removes the bonus when current tactics contradict the identity", () => {
    const contradictoryPlan: MatchTacticPlan = {
      serve: "safe",
      attack: "balanced",
      block: "read",
    };

    expect(
      calculateTeamIdentityExecutionBonus(
        identity("serve-block", 100),
        contradictoryPlan,
        "balanced",
        "serve",
      ),
    ).toBe(0);
  });
});
