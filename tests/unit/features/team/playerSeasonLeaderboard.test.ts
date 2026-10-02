import { createDemoGame } from "../../../../src/app/createDemoGame";
import { buildTeamSeasonLeaderboard } from "../../../../src/features/team/playerSeasonLeaderboard";

describe("Phase54 current-season leaderboard", () => {
  it("ranks only current-academic-year official stats", () => {
    const state = createDemoGame();
    const ids = state.schools[state.userSchoolId]!.playerIds;
    const first = state.players[ids[0]!]!;
    const second = state.players[ids[1]!]!;
    const stale = state.players[ids[2]!]!;

    first.career.seasonStats = {
      academicYear: state.calendar.academicYear,
      appearances: 3,
      setsPlayed: 7,
      points: 24,
      attackPoints: 18,
      attackAttempts: 30,
      blocks: 2,
      serviceAces: 4,
      receiveAttempts: 6,
      perfectReceives: 4,
      defensePoints: 1,
      idealSets: 0,
      successfulDigs: 3,
    };
    second.career.seasonStats = {
      academicYear: state.calendar.academicYear,
      appearances: 3,
      setsPlayed: 8,
      points: 18,
      attackPoints: 9,
      attackAttempts: 12,
      blocks: 5,
      serviceAces: 1,
      receiveAttempts: 10,
      perfectReceives: 8,
      defensePoints: 2,
      idealSets: 0,
      successfulDigs: 5,
    };
    stale.career.seasonStats = {
      academicYear: state.calendar.academicYear - 1,
      appearances: 9,
      setsPlayed: 20,
      points: 99,
      attackPoints: 60,
      attackAttempts: 80,
      blocks: 20,
      serviceAces: 15,
      receiveAttempts: 20,
      perfectReceives: 20,
      defensePoints: 4,
      idealSets: 0,
      successfulDigs: 10,
    };

    const result = buildTeamSeasonLeaderboard(state);
    const points = result.sections.find((section) => section.id === "points")!;
    const attack = result.sections.find(
      (section) => section.id === "attack-rate",
    )!;
    const receive = result.sections.find(
      (section) => section.id === "receive-rate",
    )!;

    expect(result.hasOfficialStats).toBe(true);
    expect(result.totalAppearances).toBe(6);
    expect(points.rows[0]).toMatchObject({
      playerId: first.id,
      value: 24,
      valueLabel: "24",
    });
    expect(points.rows.some((row) => row.playerId === stale.id)).toBe(false);
    expect(attack.rows[0]).toMatchObject({
      playerId: second.id,
      value: 75,
      valueLabel: "75%",
      sampleSize: 12,
    });
    expect(receive.rows[0]).toMatchObject({
      playerId: second.id,
      value: 80,
      valueLabel: "80%",
      sampleSize: 10,
    });
  });

  it("requires five attempts for rate leaderboards", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    player.career.seasonStats = {
      academicYear: state.calendar.academicYear,
      appearances: 1,
      setsPlayed: 2,
      points: 4,
      attackPoints: 4,
      attackAttempts: 4,
      blocks: 0,
      serviceAces: 0,
      receiveAttempts: 4,
      perfectReceives: 4,
      defensePoints: 0,
      idealSets: 0,
      successfulDigs: 0,
    };

    const result = buildTeamSeasonLeaderboard(state);

    expect(
      result.sections.find((section) => section.id === "attack-rate")!.rows,
    ).toEqual([]);
    expect(
      result.sections.find((section) => section.id === "receive-rate")!.rows,
    ).toEqual([]);
  });
});
