import type { GameState } from "../../src/domain/model/GameState";
import type { PlayerId } from "../../src/domain/model/identifiers";
import type {
  ArchivedRivalCandidate,
  ScoutingCandidateInsight,
  ScoutingCandidatePool,
} from "../data/ScoutingStore";
import {
  buildServerScoutReports,
  preferredRivalSchoolId,
  scoutingCycleKey,
} from "./serverScoutingBoard";

export const MAX_ARCHIVED_RIVAL_CANDIDATES = 24;

/**
 * Retain only the authoritative player truth for candidates that can be
 * signed by a rival after their original search was replaced.
 * The archive stays in the server-only scouting pool, never the game save.
 */
export function archiveReplacedScoutingPool(
  state: GameState,
  pool: ScoutingCandidatePool,
  insights: readonly ScoutingCandidateInsight[] = [],
): ArchivedRivalCandidate[] {
  const archived = [...(pool.archivedRivalCandidates ?? [])];
  if (
    pool.cycleKey !== scoutingCycleKey(state) ||
    state.recruiting?.cycleKey !== pool.cycleKey ||
    state.recruiting.scoutingSearchWeekOfYear === undefined
  ) {
    return archived.slice(-MAX_ARCHIVED_RIVAL_CANDIDATES);
  }

  const userCommitted = new Set<PlayerId>(
    state.recruiting.committedCandidateIds,
  );
  const known = new Set(archived.map((item) => item.player.id));
  const reports = buildServerScoutReports(state, pool, insights);
  const byId = new Map(
    pool.candidates.map((candidate) => [
      candidate.player.id,
      candidate.player,
    ]),
  );

  for (const report of reports) {
    if (userCommitted.has(report.candidateId) || known.has(report.candidateId)) {
      continue;
    }
    const schoolId = preferredRivalSchoolId(state, report);
    const remaining = report.recruitment?.competitorDecisionWeeksRemaining;
    if (!schoolId || remaining == null) continue;
    const signingWeekOfYear = state.calendar.weekOfYear + remaining;
    if (signingWeekOfYear > 53) continue;
    const player = byId.get(report.candidateId);
    if (!player) continue;
    known.add(report.candidateId);
    archived.push({ player: structuredClone(player), schoolId, signingWeekOfYear });
  }
  return archived.slice(-MAX_ARCHIVED_RIVAL_CANDIDATES);
}
