import { describe, expect, it } from "vitest";
import { resolveNpcTournamentMatch } from "../../../../src/domain/tournament/resolveNpcTournamentMatch";
import type {
  GuestTournamentEntrant,
  TournamentBracketMatch,
} from "../../../../src/domain/tournament/tournamentTypes";

function guest(
  entrantId: string,
  seedStrength: number,
): GuestTournamentEntrant {
  return {
    entrantId,
    source: "guest-representative",
    displayName: `${entrantId}高校`,
    shortName: entrantId,
    regionLabel: "テスト地区",
    guestSeed: `seed:${entrantId}`,
    seedStrength,
  };
}

function bracketMatch(index: number): TournamentBracketMatch {
  return {
    id: `official:interhigh:1:national:round-of-16:${index}`,
    round: "round-of-16",
    roundIndex: 0,
    slotIndex: index,
    scheduledWeek: 16,
    homeEntrantId: "strong",
    awayEntrantId: "weak",
    winnerEntrantId: null,
    homeSetsWon: null,
    awaySetsWon: null,
    status: "waiting",
  };
}

describe("resolveNpcTournamentMatch", () => {
  it("is deterministic and returns only a legal public set result", () => {
    const strong = guest("strong", 95);
    const weak = guest("weak", 70);
    const match = bracketMatch(1);

    const first = resolveNpcTournamentMatch({
      tournamentId: "official:interhigh:1:national",
      match,
      home: strong,
      away: weak,
    });
    const second = resolveNpcTournamentMatch({
      tournamentId: "official:interhigh:1:national",
      match,
      home: strong,
      away: weak,
    });

    expect(first).toEqual(second);
    expect(Object.keys(first).sort()).toEqual([
      "awaySetsWon",
      "homeSetsWon",
      "winnerEntrantId",
    ]);
    expect([strong.entrantId, weak.entrantId]).toContain(first.winnerEntrantId);
    expect([first.homeSetsWon, first.awaySetsWon]).toContain(2);
    expect(Math.min(first.homeSetsWon, first.awaySetsWon)).toBeGreaterThanOrEqual(0);
    expect(Math.min(first.homeSetsWon, first.awaySetsWon)).toBeLessThanOrEqual(1);
  });

  it("favors the stronger entrant while preserving deterministic upsets", () => {
    const strong = guest("strong", 105);
    const weak = guest("weak", 55);
    let strongWins = 0;
    let weakWins = 0;

    for (let index = 0; index < 120; index += 1) {
      const result = resolveNpcTournamentMatch({
        tournamentId: "official:spring-high:22:national",
        match: bracketMatch(index),
        home: strong,
        away: weak,
      });
      if (result.winnerEntrantId === strong.entrantId) {
        strongWins += 1;
      } else {
        weakWins += 1;
      }
    }

    expect(strongWins).toBeGreaterThan(weakWins);
    expect(weakWins).toBeGreaterThan(0);
  });
});
