import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { selectSeasonStory } from "../../../../src/domain/season/seasonStory";

function normalizeRoster() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  school.reputationPoints = 0;
  if (state.seasonGoals) {
    state.seasonGoals.startingRanks.regional = 99;
    state.seasonGoals.startingRanks.national = 99;
  }
  for (const playerId of school.playerIds) {
    const player = state.players[playerId]!;
    player.grade = 2;
    player.tier = "normal";
  }
  return state;
}

describe("Phase57 season story", () => {
  it("prioritizes defending a previous national title", () => {
    const state = normalizeRoster();
    state.calendar.academicYear = 2;
    state.history.officialTournaments.push({
      tournamentId: "phase57-national-title",
      academicYear: 1,
      circuit: "spring-high",
      level: "national",
      champion: {
        entrantId: String(state.userSchoolId),
        schoolId: state.userSchoolId,
        displayName: "青葉",
      },
      userResult: {
        qualified: true,
        bestRound: "final",
        champion: true,
      },
    });

    expect(selectSeasonStory(state)).toMatchObject({
      id: "title-defense",
      label: "王者防衛",
    });
  });

  it("recognizes an exceptional player as a golden-generation season", () => {
    const state = normalizeRoster();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId]!.tier = "generational";

    expect(selectSeasonStory(state)).toMatchObject({
      id: "golden-generation",
      label: "黄金世代",
    });
  });

  it("distinguishes a senior-heavy win-now roster from a young rebuild", () => {
    const seniorState = normalizeRoster();
    const seniorIds = seniorState.schools[seniorState.userSchoolId]!.playerIds;
    seniorIds.slice(0, 6).forEach((playerId) => {
      seniorState.players[playerId]!.grade = 3;
    });

    expect(selectSeasonStory(seniorState)).toMatchObject({
      id: "senior-window",
      label: "集大成",
    });

    const rebuildState = normalizeRoster();
    const rebuildIds =
      rebuildState.schools[rebuildState.userSchoolId]!.playerIds;
    rebuildIds.slice(0, 6).forEach((playerId) => {
      rebuildState.players[playerId]!.grade = 1;
    });

    expect(selectSeasonStory(rebuildState)).toMatchObject({
      id: "rebuild",
      label: "再構築",
    });
  });

  it("uses starting rankings for stable national and regional season arcs", () => {
    const nationalState = normalizeRoster();
    nationalState.seasonGoals!.startingRanks.national = 12;
    expect(selectSeasonStory(nationalState).id).toBe("national-chase");

    const regionalState = normalizeRoster();
    regionalState.seasonGoals!.startingRanks.regional = 3;
    expect(selectSeasonStory(regionalState).id).toBe("breakthrough");
  });

  it("falls back to a foundation season without writing new save state", () => {
    const state = normalizeRoster();
    const before = structuredClone(state.teamPlanning);

    expect(selectSeasonStory(state)).toMatchObject({
      id: "foundation",
      label: "土台づくり",
    });
    expect(state.teamPlanning).toEqual(before);
  });
});
