import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { PlayerSeasonStats } from "../../../../src/domain/model/Player";
import { selectSeasonAwards } from "../../../../src/domain/season/playerSeasonAwards";

function stats(
  academicYear: number,
  overrides: Partial<PlayerSeasonStats>,
): PlayerSeasonStats {
  return {
    academicYear,
    appearances: 4,
    setsPlayed: 8,
    points: 0,
    attackPoints: 0,
    attackAttempts: 0,
    blocks: 0,
    serviceAces: 0,
    receiveAttempts: 0,
    perfectReceives: 0,
    defensePoints: 0,
    idealSets: 0,
    successfulDigs: 0,
    ...overrides,
  };
}

describe("Phase55 season awards", () => {
  it("selects deterministic performance-based annual awards", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const [attackerId, middleId, setterId] = school.playerIds;
    if (!attackerId || !middleId || !setterId) {
      throw new Error("award fixture roster is incomplete");
    }

    const attacker = state.players[attackerId]!;
    attacker.preferredPosition = "OH";
    attacker.career.seasonStats = stats(state.calendar.academicYear, {
      points: 42,
      attackPoints: 34,
      attackAttempts: 60,
      serviceAces: 6,
      receiveAttempts: 18,
      perfectReceives: 10,
      successfulDigs: 5,
    });

    const middle = state.players[middleId]!;
    middle.preferredPosition = "MB";
    middle.career.seasonStats = stats(state.calendar.academicYear, {
      points: 24,
      attackPoints: 14,
      attackAttempts: 28,
      blocks: 12,
      serviceAces: 2,
    });

    const setter = state.players[setterId]!;
    setter.preferredPosition = "S";
    setter.career.seasonStats = stats(state.calendar.academicYear, {
      points: 8,
      attackPoints: 2,
      attackAttempts: 5,
      blocks: 2,
      serviceAces: 3,
      receiveAttempts: 10,
      perfectReceives: 8,
      idealSets: 28,
      successfulDigs: 8,
    });

    const result = selectSeasonAwards(state);
    const byCategory = Object.fromEntries(
      result.winners.map((award) => [award.category, award]),
    );

    expect(result.academicYear).toBe(state.calendar.academicYear);
    expect(byCategory.mvp?.playerId).toBe(attackerId);
    expect(byCategory.attacker?.playerId).toBe(attackerId);
    expect(byCategory.blocker?.playerId).toBe(middleId);
    expect(byCategory.server?.playerId).toBe(attackerId);
    expect(byCategory.receiver?.playerId).toBe(setterId);
    expect(byCategory.setter?.playerId).toBe(setterId);
  });

  it("omits specialist awards when sample gates are not met", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    player.preferredPosition = "S";
    player.career.seasonStats = stats(state.calendar.academicYear, {
      appearances: 1,
      points: 3,
      attackPoints: 3,
      attackAttempts: 3,
      blocks: 1,
      serviceAces: 1,
      receiveAttempts: 4,
      perfectReceives: 4,
      idealSets: 3,
    });

    const result = selectSeasonAwards(state);

    expect(result.winners).toEqual([]);
  });

  it("breaks exact score ties by player id for reproducible saves", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const ids = [...school.playerIds].sort().slice(0, 2);
    const [firstId, secondId] = ids;
    if (!firstId || !secondId) throw new Error("tie fixture missing");

    for (const playerId of ids) {
      const player = state.players[playerId]!;
      player.preferredPosition = "MB";
      player.career.seasonStats = stats(state.calendar.academicYear, {
        appearances: 3,
        blocks: 5,
      });
    }

    const result = selectSeasonAwards(state);
    const blocker = result.winners.find(
      (award) => award.category === "blocker",
    );

    expect(blocker?.playerId).toBe(firstId);
  });

  it("ignores stale season stats from a previous academic year", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId]!.career.seasonStats = stats(
      state.calendar.academicYear - 1,
      {
        appearances: 10,
        points: 100,
        attackPoints: 80,
        attackAttempts: 100,
      },
    );

    expect(selectSeasonAwards(state).winners).toEqual([]);
  });
});
