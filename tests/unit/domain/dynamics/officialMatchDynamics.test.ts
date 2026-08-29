import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import {
  applyOfficialMatchDynamicsFeedback,
  calculatePveDynamicsReadiness,
} from "../../../../src/domain/dynamics/officialMatchDynamics";
import type { MatchState } from "../../../../src/domain/model/Match";
import { matchId } from "../../../../src/domain/model/identifiers";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";

function createState() {
  return createInitialGame({
    seed: "phase7-official-dynamics",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高橋 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
}

function completedMatch(
  state: ReturnType<typeof createState>,
  userWon: boolean,
): MatchState {
  const userSelection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const opponentSchoolId = Object.keys(state.schools).find(
    (id) => id !== state.userSchoolId,
  );
  if (!opponentSchoolId) {
    throw new Error("opponent school fixture is missing");
  }
  const opponentSelection = autoSelectTeam({
    state,
    schoolId: opponentSchoolId,
  });
  const winnerSchoolId = userWon ? state.userSchoolId : opponentSchoolId;

  return {
    id: matchId("phase7-dynamics-match"),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponentSchoolId,
    homeSelection: userSelection,
    awaySelection: opponentSelection,
    bestOfSets: 3,
    phase: "match-complete",
    currentSetNumber: 2,
    homeSetsWon: userWon ? 2 : 0,
    awaySetsWon: userWon ? 0 : 2,
    sets: [
      {
        setNumber: 1,
        homeScore: userWon ? 25 : 20,
        awayScore: userWon ? 20 : 25,
        completed: true,
        winnerSchoolId,
      },
      {
        setNumber: 2,
        homeScore: userWon ? 25 : 21,
        awayScore: userWon ? 21 : 25,
        completed: true,
        winnerSchoolId,
      },
    ],
    servingSchoolId: state.userSchoolId,
    pendingCoachCommandForSchoolId: null,
    eventLog: [],
    randomSeed: "phase7-dynamics-match",
    randomCursor: 0,
  };
}

describe("official match dynamics", () => {
  it("keeps user PvE readiness within 0.95..1.05 and returns 1 for NPC schools", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const rivalSchoolId = Object.keys(state.schools).find(
      (id) => id !== state.userSchoolId,
    )!;
    const rivalPlayerId = state.schools[rivalSchoolId]!.playerIds[0]!;

    state.teamDynamics.cohesion = 100;
    state.players[playerId] = {
      ...state.players[playerId]!,
      morale: 100,
      trust: 100,
    };
    const high = calculatePveDynamicsReadiness(
      state,
      state.userSchoolId,
      playerId,
    );

    state.teamDynamics.cohesion = 0;
    state.players[playerId] = {
      ...state.players[playerId]!,
      morale: 0,
      trust: 0,
    };
    const low = calculatePveDynamicsReadiness(
      state,
      state.userSchoolId,
      playerId,
    );

    expect(high).toBeGreaterThan(1);
    expect(high).toBeLessThanOrEqual(1.05);
    expect(low).toBeGreaterThanOrEqual(0.95);
    expect(low).toBeLessThan(1);
    expect(
      calculatePveDynamicsReadiness(state, rivalSchoolId, rivalPlayerId),
    ).toBe(1);
  });

  it("records official starter usage and applies bounded win feedback", () => {
    const state = createState();
    const match = completedMatch(state, true);
    const starterIds = new Set([
      ...match.homeSelection.rotation.map((entry) => entry.playerId),
      match.homeSelection.liberoPlayerId!,
    ]);
    const before = structuredClone(state);

    const next = applyOfficialMatchDynamicsFeedback({
      state,
      match,
      won: true,
    });

    expect(next.teamDynamics.recentOfficialMatchesTracked).toBe(1);
    for (const playerId of starterIds) {
      expect(next.teamDynamics.recentOfficialStarterCounts[playerId]).toBe(1);
    }
    for (const playerId of state.schools[state.userSchoolId]!.playerIds) {
      expect(next.players[playerId]!.morale).toBeLessThanOrEqual(100);
      expect(next.players[playerId]!.trust).toBeLessThanOrEqual(100);
      expect(next.players[playerId]!.morale).toBeGreaterThanOrEqual(
        before.players[playerId]!.morale,
      );
      expect(next.players[playerId]!.trust).toBeGreaterThanOrEqual(
        before.players[playerId]!.trust,
      );
    }
    expect(next.teamDynamics.cohesion).toBeGreaterThanOrEqual(0);
    expect(next.teamDynamics.cohesion).toBeLessThanOrEqual(100);
    expect(state).toEqual(before);
  });

  it("applies bounded loss feedback without changing non-user players", () => {
    const state = createState();
    const match = completedMatch(state, false);
    const opponentId = match.awaySelection.rotation[0]!.playerId;
    const opponentBefore = structuredClone(state.players[opponentId]!);
    const userId = match.homeSelection.rotation[0]!.playerId;
    const userBefore = structuredClone(state.players[userId]!);

    const next = applyOfficialMatchDynamicsFeedback({
      state,
      match,
      won: false,
    });

    expect(next.players[userId]!.morale).toBeLessThanOrEqual(userBefore.morale);
    expect(next.players[userId]!.trust).toBeLessThanOrEqual(userBefore.trust);
    expect(next.players[userId]!.morale).toBeGreaterThanOrEqual(0);
    expect(next.players[userId]!.trust).toBeGreaterThanOrEqual(0);
    expect(next.players[opponentId]).toEqual(opponentBefore);
  });
});
