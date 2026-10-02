import { createDemoGame } from "../../../../src/app/createDemoGame";
import { playerId } from "../../../../src/domain/model/identifiers";
import { buildSchoolLegacyLeaderboard } from "../../../../src/features/team/playerLegacyLeaderboard";

describe("Phase54 school legacy leaderboard", () => {
  it(
    "combines active players and user-school graduates without new persistence",
    () => {
    const state = createDemoGame();
    const activeId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const active = state.players[activeId]!;
    active.career.appearances = 12;
    active.career.points = 88;
    active.career.blocks = 14;
    active.career.serviceAces = 9;

    state.history.graduates.push({
      playerId: playerId("legacy-graduate"),
      schoolId: state.userSchoolId,
      graduationYear: state.calendar.academicYear - 1,
      displayName: "卒業 太郎",
      position: "OH",
      appearances: 20,
      points: 140,
      blocks: 6,
      serviceAces: 12,
      awardIds: [],
    });

    const result = buildSchoolLegacyLeaderboard(state);

    expect(result.hasRecords).toBe(true);
    expect(
      result.sections.find((section) => section.id === "points")?.rows[0],
    ).toMatchObject({
      displayName: "卒業 太郎",
      value: 140,
      statusLabel: `${state.calendar.academicYear - 1}年卒`,
      active: false,
    });
      expect(
        result.sections
          .find((section) => section.id === "appearances")
          ?.rows.some((row) => row.playerId === activeId && row.active),
      ).toBe(true);
    },
  );

  it(
    "filters graduates from other schools and caps each category at five",
    () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    for (let index = 0; index < school.playerIds.length; index += 1) {
      const player = state.players[school.playerIds[index]!]!;
      player.career.points = 100 - index;
    }

    state.history.graduates.push({
      playerId: playerId("other-school-graduate"),
      schoolId: Object.values(state.schools).find(
        (candidate) => candidate.id !== state.userSchoolId,
      )!.id,
      graduationYear: state.calendar.academicYear - 1,
      displayName: "他校 選手",
      position: "OP",
      appearances: 99,
      points: 999,
      blocks: 99,
      serviceAces: 99,
      awardIds: [],
    });

    const result = buildSchoolLegacyLeaderboard(state);
    const points = result.sections.find((section) => section.id === "points")!;

    expect(points.rows).toHaveLength(5);
      expect(
        points.rows.some((row) => row.displayName === "他校 選手"),
      ).toBe(false);
    },
  );
});
