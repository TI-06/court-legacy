import type {
  CoachDecisionReason,
  MatchCommand,
} from "../model/Match";
import type { SchoolReputation } from "../model/School";
import type { SchoolId } from "../model/identifiers";
import type { MatchTacticPlan } from "../team/matchTactics";

export type CpuCoachTier = 0 | 1 | 2 | 3;

export interface CpuCoachPublicStats {
  ownAces: number;
  ownServeErrors: number;
  opponentAces: number;
  ownAttackPoints: number;
  opponentAttackPoints: number;
  ownBlockPoints: number;
  opponentBlockPoints: number;
}

export interface CpuCoachPublicView {
  schoolId: SchoolId;
  opponentSchoolId: SchoolId;
  archetypeId: string;
  reputation: SchoolReputation;
  coachTactics: number;
  ownPlan: MatchTacticPlan;
  opponentPlan: MatchTacticPlan;
  score: { own: number; opponent: number };
  setNumber: number;
  ownSetsWon: number;
  opponentSetsWon: number;
  runLength: number;
  runWinnerSchoolId: SchoolId | null;
  timeoutAvailable: boolean;
  publicStats: CpuCoachPublicStats;
}

type CpuCoachCommand = Extract<
  MatchCommand,
  { type: "timeout" } | { type: "set-match-tactics" } | { type: "continue" }
>;

const REPUTATION_WEIGHT: Record<SchoolReputation, number> = {
  unknown: 0,
  "district-contender": 8,
  "prefectural-power": 16,
  "national-qualifier": 24,
  "national-regular": 32,
  elite: 40,
};

export function cpuCoachTier(
  reputation: SchoolReputation,
  coachTactics: number,
): CpuCoachTier {
  const boundedTactics = Math.max(0, Math.min(100, coachTactics));
  const score = boundedTactics + REPUTATION_WEIGHT[reputation];
  if (score < 50) return 0;
  if (score < 65) return 1;
  if (score < 82) return 2;
  return 3;
}

function withPlan(
  current: MatchTacticPlan,
  change: Partial<MatchTacticPlan>,
): CpuCoachCommand {
  return {
    type: "set-match-tactics",
    plan: { ...current, ...change },
  };
}

function shouldUseTimeout(
  view: CpuCoachPublicView,
  tier: CpuCoachTier,
): boolean {
  if (!view.timeoutAvailable || view.runWinnerSchoolId !== view.opponentSchoolId) {
    return false;
  }
  const requiredRun = tier === 0 ? 6 : tier === 1 ? 5 : 4;
  return view.runLength >= requiredRun;
}

function shouldReduceServeRisk(view: CpuCoachPublicView): boolean {
  if (view.ownPlan.serve !== "aggressive") return false;
  const { ownAces, ownServeErrors } = view.publicStats;
  return ownServeErrors >= 4 && ownServeErrors >= ownAces + 3;
}

export function decideCpuCoachCommand(
  view: CpuCoachPublicView,
  reason: CoachDecisionReason,
): CpuCoachCommand {
  const tier = cpuCoachTier(view.reputation, view.coachTactics);

  if (reason === "opponent-run" && shouldUseTimeout(view, tier)) {
    return { type: "timeout" };
  }

  if (tier === 0) {
    return { type: "continue" };
  }

  if (shouldReduceServeRisk(view)) {
    return withPlan(view.ownPlan, { serve: "balanced" });
  }

  if (tier >= 2) {
    if (
      view.opponentPlan.attack === "quick" &&
      view.ownPlan.block !== "commit"
    ) {
      return withPlan(view.ownPlan, { block: "commit" });
    }
    if (
      view.opponentPlan.attack === "side" &&
      view.ownPlan.block !== "read"
    ) {
      return withPlan(view.ownPlan, { block: "read" });
    }
  }

  return { type: "continue" };
}
