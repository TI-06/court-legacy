import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceAcademicYear } from "../../../../src/domain/calendar/academicYearProgression";
import { setTeamLeadership } from "../../../../src/domain/dynamics/setTeamLeadership";
import type { GameState } from "../../../../src/domain/model/GameState";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";

function assignReturningLeadership(state: GameState): GameState {
  const school = state.schools[state.userSchoolId]!;
  const candidates = school.playerIds
    .filter((playerId) => (state.players[playerId]?.grade ?? 3) < 3)
    .sort((left, right) => left.localeCompare(right));

  if (candidates.length < 2) {
    return state;
  }

  return setTeamLeadership(state, candidates[0]!, candidates[1]!);
}

function expectDynamicsValid(state: GameState): void {
  const school = state.schools[state.userSchoolId]!;
  const activeIds = new Set<PlayerId>(school.playerIds);
  const dynamics = state.teamDynamics;

  expect(dynamics.cohesion).toBeGreaterThanOrEqual(0);
  expect(dynamics.cohesion).toBeLessThanOrEqual(100);
  expect(dynamics.previousCohesion).toBeGreaterThanOrEqual(0);
  expect(dynamics.previousCohesion).toBeLessThanOrEqual(100);
  expect(dynamics.lineupContinuity).toBeGreaterThanOrEqual(0);
  expect(dynamics.lineupContinuity).toBeLessThanOrEqual(100);
  expect(dynamics.recentOfficialMatchesTracked).toBeGreaterThanOrEqual(0);
  expect(dynamics.recentOfficialMatchesTracked).toBeLessThanOrEqual(8);

  if (dynamics.captainPlayerId) {
    expect(activeIds.has(dynamics.captainPlayerId)).toBe(true);
    expect(school.captainPlayerId).toBe(dynamics.captainPlayerId);
  }
  if (dynamics.viceCaptainPlayerId) {
    expect(activeIds.has(dynamics.viceCaptainPlayerId)).toBe(true);
  }
  if (dynamics.captainPlayerId && dynamics.viceCaptainPlayerId) {
    expect(dynamics.captainPlayerId).not.toBe(dynamics.viceCaptainPlayerId);
  }

  const boundedMaps = [
    dynamics.playerRoles,
    dynamics.playerConcerns,
    dynamics.recentOfficialStarterCounts,
  ];
  for (const map of boundedMaps) {
    expect(Object.keys(map).length).toBeLessThanOrEqual(activeIds.size);
  }

  for (const playerId of Object.keys(dynamics.playerRoles) as PlayerId[]) {
    expect(activeIds.has(playerId)).toBe(true);
  }
  for (const playerId of Object.keys(dynamics.playerConcerns) as PlayerId[]) {
    expect(activeIds.has(playerId)).toBe(true);
    for (const concern of dynamics.playerConcerns[playerId] ?? []) {
      expect(concern.severity).toBeGreaterThanOrEqual(1);
      expect(concern.severity).toBeLessThanOrEqual(3);
    }
  }
  for (const [playerId, count] of Object.entries(
    dynamics.recentOfficialStarterCounts,
  )) {
    expect(activeIds.has(playerId as PlayerId)).toBe(true);
    expect(count).toBeGreaterThanOrEqual(0);
    expect(count).toBeLessThanOrEqual(8);
  }

  for (const playerId of school.playerIds) {
    const player = state.players[playerId]!;
    expect(player.morale).toBeGreaterThanOrEqual(0);
    expect(player.morale).toBeLessThanOrEqual(100);
    expect(player.trust).toBeGreaterThanOrEqual(0);
    expect(player.trust).toBeLessThanOrEqual(100);
  }
}

function runYears(years: number): GameState {
  let state = createDemoGame();

  for (let year = 0; year < years; year += 1) {
    state = assignReturningLeadership(state);
    const random = new SeededRandom(state.seed, state.randomCursor);
    state = advanceAcademicYear(state, gameData, random).state;
    expectDynamicsValid(state);
  }

  return state;
}

function dynamicsSnapshot(state: GameState) {
  const school = state.schools[state.userSchoolId]!;
  return {
    yearIndex: state.yearIndex,
    randomCursor: state.randomCursor,
    captainPlayerId: state.teamDynamics.captainPlayerId,
    viceCaptainPlayerId: state.teamDynamics.viceCaptainPlayerId,
    cohesion: state.teamDynamics.cohesion,
    previousCohesion: state.teamDynamics.previousCohesion,
    cohesionTrend: state.teamDynamics.cohesionTrend,
    lineupContinuity: state.teamDynamics.lineupContinuity,
    playerRoles: state.teamDynamics.playerRoles,
    playerConcerns: state.teamDynamics.playerConcerns,
    recentOfficialStarterCounts: state.teamDynamics.recentOfficialStarterCounts,
    recentOfficialMatchesTracked:
      state.teamDynamics.recentOfficialMatchesTracked,
    roster: school.playerIds.map((playerId) => {
      const player = state.players[playerId]!;
      return {
        id: player.id,
        grade: player.grade,
        morale: player.morale,
        trust: player.trust,
      };
    }),
  };
}

describe("team dynamics long-run", () => {
  it("produces the same bounded dynamics after 30 years from the same seed", () => {
    expect(dynamicsSnapshot(runYears(30))).toEqual(
      dynamicsSnapshot(runYears(30)),
    );
  });

  it("keeps leadership and dynamics bounded across a 100-year soak", () => {
    expectDynamicsValid(runYears(100));
  });
});
