import type { Position } from "../model/Player";
import type { TeamTactics } from "../model/School";
import { applyMatchTacticPlan, type MatchTacticPlan } from "../team/matchTactics";

export type SchoolMatchAdaptationBias =
  | "hold-style"
  | "balanced"
  | "counter-heavy";

export interface SchoolMatchIdentityProfile {
  preferredPlan: MatchTacticPlan;
  defensePreference: TeamTactics["defenseBias"];
  attackDistributionBias: Partial<Record<Position, number>>;
  adaptationBias: SchoolMatchAdaptationBias;
}

const IDENTITIES: Readonly<Record<string, SchoolMatchIdentityProfile>> = {
  "school.balanced": {
    preferredPlan: { serve: "balanced", attack: "balanced", block: "mixed" },
    defensePreference: "balanced",
    attackDistributionBias: { OH: 40, MB: 22, OP: 34, S: 4, L: 0 },
    adaptationBias: "balanced",
  },
  "school.defense": {
    preferredPlan: { serve: "safe", attack: "side", block: "read" },
    defensePreference: "cross",
    attackDistributionBias: { OH: 44, MB: 16, OP: 36, S: 4, L: 0 },
    adaptationBias: "hold-style",
  },
  "school.height": {
    preferredPlan: { serve: "balanced", attack: "side", block: "commit" },
    defensePreference: "line",
    attackDistributionBias: { OH: 40, MB: 24, OP: 32, S: 4, L: 0 },
    adaptationBias: "balanced",
  },
  "school.speed": {
    preferredPlan: { serve: "balanced", attack: "quick", block: "read" },
    defensePreference: "balanced",
    attackDistributionBias: { OH: 32, MB: 34, OP: 30, S: 4, L: 0 },
    adaptationBias: "counter-heavy",
  },
  "school.ace": {
    preferredPlan: { serve: "aggressive", attack: "side", block: "mixed" },
    defensePreference: "balanced",
    attackDistributionBias: { OH: 50, MB: 10, OP: 36, S: 4, L: 0 },
    adaptationBias: "balanced",
  },
  "school.serve": {
    preferredPlan: {
      serve: "aggressive",
      attack: "balanced",
      block: "commit",
    },
    defensePreference: "line",
    attackDistributionBias: { OH: 39, MB: 23, OP: 34, S: 4, L: 0 },
    adaptationBias: "counter-heavy",
  },
  "school.development": {
    preferredPlan: { serve: "balanced", attack: "balanced", block: "read" },
    defensePreference: "balanced",
    attackDistributionBias: { OH: 39, MB: 23, OP: 34, S: 4, L: 0 },
    adaptationBias: "hold-style",
  },
  "school.rotation": {
    preferredPlan: { serve: "balanced", attack: "balanced", block: "mixed" },
    defensePreference: "balanced",
    attackDistributionBias: { OH: 37, MB: 27, OP: 32, S: 4, L: 0 },
    adaptationBias: "counter-heavy",
  },
};

const FALLBACK_IDENTITY = IDENTITIES["school.balanced"]!;

export function schoolMatchIdentity(
  archetypeId: string,
): SchoolMatchIdentityProfile {
  return IDENTITIES[archetypeId] ?? FALLBACK_IDENTITY;
}

export function applySchoolMatchIdentityDefaults(
  tactics: TeamTactics,
  archetypeId: string,
): TeamTactics {
  const identity = schoolMatchIdentity(archetypeId);
  const planned = applyMatchTacticPlan(tactics, identity.preferredPlan);
  return {
    ...planned,
    attackDistribution: {
      ...planned.attackDistribution,
      ...identity.attackDistributionBias,
    },
    defenseBias: identity.defensePreference,
  };
}
