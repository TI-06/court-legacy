import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  buildPlayerCareerPresentation,
  buildPlayerSeasonPresentation,
} from "../../../../src/features/team/playerCareerPresentation";

describe("Phase54 player career presentation", () => {
  it("derives compact official career totals without changing player data", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    player.career.appearances = 8;
    player.career.setsPlayed = 19;
    player.career.points = 67;
    player.career.blocks = 11;
    player.career.serviceAces = 7;
    player.career.captainSeasons = 1;
    player.career.awardIds = ["award.a", "award.b"];
    player.career.bestTournamentResultId = "national:semifinalist";

    const before = structuredClone(player.career);
    const result = buildPlayerCareerPresentation(player);

    expect(result).toEqual({
      appearances: 8,
      setsPlayed: 19,
      points: 67,
      blocks: 11,
      serviceAces: 7,
      pointsPerAppearance: 8.4,
      captainSeasons: 1,
      awardCount: 2,
      bestTournamentResultLabel: "全国大会 ベスト4",
    });
    expect(player.career).toEqual(before);
  });

  it("shows safe zero-state labels before an official appearance", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    player.career.appearances = 0;
    player.career.points = 0;
    player.career.bestTournamentResultId = null;

    const result = buildPlayerCareerPresentation(player);

    expect(result.pointsPerAppearance).toBe(0);
    expect(result.bestTournamentResultLabel).toBe("記録なし");
  });

  it("shows only the requested academic year's season totals", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    player.career.seasonStats = {
      academicYear: state.calendar.academicYear,
      appearances: 4,
      setsPlayed: 9,
      points: 31,
      attackPoints: 18,
      attackAttempts: 30,
      blocks: 5,
      serviceAces: 3,
      receiveAttempts: 10,
      perfectReceives: 8,
      defensePoints: 2,
      idealSets: 0,
      successfulDigs: 4,
    };

    expect(
      buildPlayerSeasonPresentation(player, state.calendar.academicYear),
    ).toMatchObject({
      appearances: 4,
      points: 31,
      blocks: 5,
      serviceAces: 3,
      attackSuccessRate: 60,
      perfectReceiveRate: 80,
    });
    expect(
      buildPlayerSeasonPresentation(player, state.calendar.academicYear + 1),
    ).toMatchObject({
      appearances: 0,
      points: 0,
      blocks: 0,
      serviceAces: 0,
      attackSuccessRate: 0,
      perfectReceiveRate: 0,
    });
  });
});
