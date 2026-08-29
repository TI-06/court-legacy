import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";
import type { PlayerId } from "../../../../src/domain/model/identifiers";

function prepareRolloverState() {
  const state = createDemoGame();
  state.date = "2027-03-31";
  state.calendar.currentDate = state.date;
  state.calendar.weekOfYear = 52;
  state.world.nextGenerationalTalentYear = 6;
  return state;
}

function userPlayersByGrade(state: ReturnType<typeof prepareRolloverState>) {
  const school = state.schools[state.userSchoolId]!;
  return {
    grade3: school.playerIds.filter((id) => state.players[id]?.grade === 3),
    grade2: school.playerIds.filter((id) => state.players[id]?.grade === 2),
  };
}

describe("phase 7 academic-year dynamics lifecycle", () => {
  it("credits the captain who actually completed the year and clears graduated leadership", () => {
    const state = prepareRolloverState();
    const school = state.schools[state.userSchoolId]!;
    const { grade3 } = userPlayersByGrade(state);
    const captainId = grade3[0]!;
    const viceCaptainId = grade3[1]!;
    const captainBefore = state.players[captainId]!.career.captainSeasons;

    school.captainPlayerId = captainId;
    state.teamDynamics = {
      ...state.teamDynamics,
      captainPlayerId: captainId,
      viceCaptainPlayerId: viceCaptainId,
      recentOfficialStarterCounts: {
        [captainId]: 7,
        [viceCaptainId]: 6,
      },
      recentOfficialMatchesTracked: 8,
      playerRoles: {
        [captainId]: "ace",
        [viceCaptainId]: "starter",
      },
      playerConcerns: {
        [captainId]: [{ code: "playing-time", severity: 2 }],
      },
    };

    const result = advanceGameWeek(state, gameData);
    const nextSchool = result.state.schools[state.userSchoolId]!;

    expect(result.academicYearTransition).not.toBeNull();
    expect(result.state.players[captainId]!.career.captainSeasons).toBe(
      captainBefore + 1,
    );
    expect(nextSchool.playerIds).not.toContain(captainId);
    expect(nextSchool.playerIds).not.toContain(viceCaptainId);
    expect(nextSchool.captainPlayerId).toBeNull();
    expect(result.state.teamDynamics.captainPlayerId).toBeNull();
    expect(result.state.teamDynamics.viceCaptainPlayerId).toBeNull();
    expect(result.state.teamDynamics.recentOfficialMatchesTracked).toBe(0);
    expect(result.state.teamDynamics.recentOfficialStarterCounts).toEqual({});
    expect(result.state.teamDynamics.playerRoles[captainId]).toBeUndefined();
    expect(result.state.teamDynamics.playerConcerns[captainId]).toBeUndefined();
  });

  it("preserves returning manual leadership and rebuilds bounded dynamics for the new roster", () => {
    const state = prepareRolloverState();
    const school = state.schools[state.userSchoolId]!;
    const { grade2, grade3 } = userPlayersByGrade(state);
    const captainId = grade2[0]!;
    const viceCaptainId = grade2[1]!;
    const staleId = grade3[0]!;
    const captainBefore = state.players[captainId]!.career.captainSeasons;

    school.captainPlayerId = captainId;
    state.teamDynamics = {
      ...state.teamDynamics,
      captainPlayerId: captainId,
      viceCaptainPlayerId: viceCaptainId,
      cohesion: 61,
      previousCohesion: 57,
      recentOfficialStarterCounts: {
        [captainId]: 8,
        [viceCaptainId]: 5,
        [staleId]: 8,
      },
      recentOfficialMatchesTracked: 8,
      playerRoles: {
        [captainId]: "starter",
        [viceCaptainId]: "rotation",
        [staleId]: "ace",
      },
      playerConcerns: {
        [staleId]: [{ code: "team-slump", severity: 1 }],
      },
    };

    const result = advanceGameWeek(state, gameData);
    const next = result.state;
    const nextSchool = next.schools[next.userSchoolId]!;
    const activeIds = new Set<PlayerId>(nextSchool.playerIds);

    expect(next.players[captainId]!.career.captainSeasons).toBe(
      captainBefore + 1,
    );
    expect(nextSchool.captainPlayerId).toBe(captainId);
    expect(next.teamDynamics.captainPlayerId).toBe(captainId);
    expect(next.teamDynamics.viceCaptainPlayerId).toBe(viceCaptainId);
    expect(next.teamDynamics.recentOfficialMatchesTracked).toBe(0);
    expect(next.teamDynamics.recentOfficialStarterCounts).toEqual({});
    expect(next.teamDynamics.playerRoles[staleId]).toBeUndefined();
    expect(next.teamDynamics.playerConcerns[staleId]).toBeUndefined();
    for (const playerId of Object.keys(next.teamDynamics.playerRoles) as PlayerId[]) {
      expect(activeIds.has(playerId)).toBe(true);
    }
    for (const playerId of Object.keys(next.teamDynamics.playerConcerns) as PlayerId[]) {
      expect(activeIds.has(playerId)).toBe(true);
    }
    expect(next.teamDynamics.cohesion).toBeGreaterThanOrEqual(0);
    expect(next.teamDynamics.cohesion).toBeLessThanOrEqual(100);
  });
});
