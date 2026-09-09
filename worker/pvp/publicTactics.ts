import type { School } from "../../src/domain/model/School";
import {
  deriveMatchTacticPlan,
  type PublicTacticSummary,
} from "../../src/domain/team/matchTactics";

interface Phase15PublishedSchool extends School {
  phase15PublicTactics?: PublicTacticSummary;
}

function isPublicTacticSummary(value: unknown): value is PublicTacticSummary {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    ["safe", "balanced", "aggressive"].includes(String(candidate.serve)) &&
    ["side", "balanced", "quick"].includes(String(candidate.attack)) &&
    ["commit", "mixed", "read"].includes(String(candidate.block))
  );
}

export function freezePublicTactics(school: School): School {
  const snapshot: Phase15PublishedSchool = {
    ...structuredClone(school),
    phase15PublicTactics: deriveMatchTacticPlan(school.tactics),
  };
  return snapshot;
}

export function readPublicTactics(
  school: School,
): PublicTacticSummary | undefined {
  const value = (school as Phase15PublishedSchool).phase15PublicTactics;
  return isPublicTacticSummary(value) ? structuredClone(value) : undefined;
}
