import { describe, expect, it } from "vitest";
import { schoolId } from "../../../../src/domain/model/identifiers";
import {
  cpuCoachTier,
  decideCpuCoachCommand,
  type CpuCoachPublicView,
} from "../../../../src/domain/match/cpuCoachPolicy";

const cpuId = schoolId("school.cpu");
const userId = schoolId("school.user");

function view(overrides: Partial<CpuCoachPublicView> = {}): CpuCoachPublicView {
  return {
    schoolId: cpuId,
    opponentSchoolId: userId,
    archetypeId: "school.balanced",
    reputation: "national-regular",
    coachTactics: 82,
    ownPlan: { serve: "balanced", attack: "balanced", block: "mixed" },
    opponentPlan: { serve: "balanced", attack: "balanced", block: "mixed" },
    score: { own: 18, opponent: 18 },
    setNumber: 1,
    ownSetsWon: 0,
    opponentSetsWon: 0,
    runLength: 0,
    runWinnerSchoolId: null,
    timeoutAvailable: true,
    publicStats: {
      ownAces: 2,
      ownServeErrors: 2,
      opponentAces: 2,
      ownAttackPoints: 12,
      opponentAttackPoints: 12,
      ownBlockPoints: 2,
      opponentBlockPoints: 2,
    },
    ...overrides,
  };
}

describe("Phase19-4 CPU coach policy", () => {
  it("derives stronger decision tiers monotonically from reputation and coach tactics", () => {
    expect(cpuCoachTier("unknown", 35)).toBe(0);
    expect(cpuCoachTier("district-contender", 50)).toBeGreaterThanOrEqual(1);
    expect(cpuCoachTier("national-qualifier", 65)).toBeGreaterThanOrEqual(2);
    expect(cpuCoachTier("elite", 80)).toBe(3);
  });

  it("lets a weak CPU hold its identity in a neutral set-break", () => {
    expect(
      decideCpuCoachCommand(
        view({ reputation: "unknown", coachTactics: 35 }),
        "set-break",
      ),
    ).toEqual({ type: "continue" });
  });

  it("lets a strong CPU counter a public quick-attack mismatch with commit block", () => {
    expect(
      decideCpuCoachCommand(
        view({
          opponentPlan: { serve: "balanced", attack: "quick", block: "mixed" },
        }),
        "set-break",
      ),
    ).toEqual({
      type: "set-match-tactics",
      plan: { serve: "balanced", attack: "balanced", block: "commit" },
    });
  });

  it("backs off aggressive serving when public serve-error evidence is poor", () => {
    expect(
      decideCpuCoachCommand(
        view({
          ownPlan: { serve: "aggressive", attack: "balanced", block: "mixed" },
          publicStats: {
            ownAces: 1,
            ownServeErrors: 7,
            opponentAces: 2,
            ownAttackPoints: 12,
            opponentAttackPoints: 12,
            ownBlockPoints: 2,
            opponentBlockPoints: 2,
          },
        }),
        "set-break",
      ),
    ).toEqual({
      type: "set-match-tactics",
      plan: { serve: "balanced", attack: "balanced", block: "mixed" },
    });
  });

  it("uses an available timeout against a severe opponent scoring run", () => {
    expect(
      decideCpuCoachCommand(
        view({
          runLength: 5,
          runWinnerSchoolId: userId,
          score: { own: 14, opponent: 19 },
        }),
        "opponent-run",
      ),
    ).toEqual({ type: "timeout" });
  });

  it("is deterministic for the same public view", () => {
    const input = view({
      opponentPlan: { serve: "aggressive", attack: "side", block: "read" },
      publicStats: {
        ownAces: 0,
        ownServeErrors: 3,
        opponentAces: 6,
        ownAttackPoints: 8,
        opponentAttackPoints: 14,
        ownBlockPoints: 1,
        opponentBlockPoints: 4,
      },
    });

    expect(decideCpuCoachCommand(input, "set-break")).toEqual(
      decideCpuCoachCommand(structuredClone(input), "set-break"),
    );
  });
});
