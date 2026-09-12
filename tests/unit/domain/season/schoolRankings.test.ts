import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  buildSchoolRankings,
  schoolRankingSnapshot,
} from "../../../../src/domain/season/schoolRankings";

describe("Phase17 school rankings", () => {
  it("ranks deterministically by reputation, official achievements, then school id", () => {
    const state = createDemoGame();
    const schools = Object.values(state.schools);
    const first = schools[0]!;
    const second = schools[1]!;
    const third = schools[2]!;

    for (const school of [first, second, third]) {
      school.reputationPoints = 500;
      school.history.nationalTitles = 0;
      school.history.nationalAppearances = 0;
      school.history.prefecturalTitles = 0;
      school.history.officialWins = 0;
      school.history.officialLosses = 0;
    }
    second.history.nationalTitles = 1;
    third.history.nationalAppearances = 1;

    const ranked = buildSchoolRankings(state);
    const relevant = ranked.filter((row) =>
      [first.id, second.id, third.id].includes(row.schoolId),
    );

    expect(relevant.map((row) => row.schoolId)).toEqual([
      second.id,
      third.id,
      first.id,
    ]);
    expect(ranked.map((row) => row.rank)).toEqual(
      Array.from({ length: ranked.length }, (_, index) => index + 1),
    );
  });

  it("supports region-scoped ranking without changing national ranking", () => {
    const state = createDemoGame();
    const user = state.schools[state.userSchoolId]!;
    const opponent = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    opponent.regionId = "other-region";
    opponent.reputationPoints = 1400;
    user.reputationPoints = 100;

    const national = buildSchoolRankings(state);
    const regional = buildSchoolRankings(state, { regionId: user.regionId });
    const snapshot = schoolRankingSnapshot(state, user.id);

    expect(national[0]!.schoolId).toBe(opponent.id);
    expect(regional.some((row) => row.schoolId === opponent.id)).toBe(false);
    expect(snapshot.national.total).toBe(Object.keys(state.schools).length);
    expect(snapshot.regional.total).toBe(
      Object.values(state.schools).filter(
        (school) => school.regionId === user.regionId,
      ).length,
    );
  });

  it("is stable when school object insertion order changes", () => {
    const state = createDemoGame();
    const reversed = {
      ...state,
      schools: Object.fromEntries(Object.entries(state.schools).reverse()),
    };

    expect(buildSchoolRankings(reversed).map((row) => row.schoolId)).toEqual(
      buildSchoolRankings(state).map((row) => row.schoolId),
    );
  });
});
