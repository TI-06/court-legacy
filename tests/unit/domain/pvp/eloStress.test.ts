import { describe, expect, it } from "vitest";
import { calculateEloUpdate } from "../../../../src/domain/pvp/elo";

interface StressRecord {
  rating: number;
  matches: number;
  wins: number;
  losses: number;
  currentWinStreak: number;
  maxWinStreak: number;
}

function createRecord(): StressRecord {
  return {
    rating: 1000,
    matches: 0,
    wins: 0,
    losses: 0,
    currentWinStreak: 0,
    maxWinStreak: 0,
  };
}

function recordWin(record: StressRecord): void {
  record.matches += 1;
  record.wins += 1;
  record.currentWinStreak += 1;
  record.maxWinStreak = Math.max(record.maxWinStreak, record.currentWinStreak);
}

function recordLoss(record: StressRecord): void {
  record.matches += 1;
  record.losses += 1;
  record.currentWinStreak = 0;
}

describe("PvP Elo long-run safeguards", () => {
  it("keeps ratings and records bounded while duplicate operations are applied once", () => {
    const teams = Array.from({ length: 8 }, () => createRecord());
    const appliedOperations = new Set<string>();
    const uniqueMatchCount = 5_000;
    let appliedCount = 0;

    for (let replayPass = 0; replayPass < 2; replayPass += 1) {
      for (let matchIndex = 0; matchIndex < uniqueMatchCount; matchIndex += 1) {
        const operationId = `stress-${matchIndex}`;
        if (appliedOperations.has(operationId)) continue;
        appliedOperations.add(operationId);
        appliedCount += 1;

        const challengerIndex = matchIndex % teams.length;
        const defenderIndex = (matchIndex * 3 + 1) % teams.length;
        const challenger = teams[challengerIndex]!;
        const defender = teams[defenderIndex]!;
        const challengerWon = (matchIndex * 17 + 11) % 7 < 4;

        const update = calculateEloUpdate({
          challengerRating: challenger.rating,
          defenderRating: defender.rating,
          challengerWon,
        });
        challenger.rating = update.challengerRating;
        defender.rating = update.defenderRating;

        if (challengerWon) {
          recordWin(challenger);
          recordLoss(defender);
        } else {
          recordLoss(challenger);
          recordWin(defender);
        }
      }
    }

    expect(appliedOperations).toHaveLength(uniqueMatchCount);
    expect(appliedCount).toBe(uniqueMatchCount);
    expect(teams.reduce((sum, team) => sum + team.matches, 0)).toBe(
      uniqueMatchCount * 2,
    );

    for (const team of teams) {
      expect(Number.isFinite(team.rating)).toBe(true);
      expect(team.rating).toBeGreaterThanOrEqual(0);
      expect(team.matches).toBe(team.wins + team.losses);
      expect(team.currentWinStreak).toBeLessThanOrEqual(team.wins);
      expect(team.maxWinStreak).toBeLessThanOrEqual(team.wins);
      expect(team.maxWinStreak).toBeLessThanOrEqual(team.matches);
    }
  });
});
