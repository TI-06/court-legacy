import { describe, expect, test } from "vitest";
import type { GameState } from "../../../../src/domain/model/GameState";
import type { Player } from "../../../../src/domain/model/Player";
import { playerId, schoolId } from "../../../../src/domain/model/identifiers";
import {
  calculateCohesionTarget,
  calculateLeadershipSuitability,
  calculateRelationshipSignal,
  deriveCohesionTrend,
} from "../../../../src/domain/dynamics/calculateTeamDynamics";
import type { TeamDynamicsState } from "../../../../src/domain/dynamics/teamDynamicsTypes";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: playerId("player-a"),
    firstName: "太郎",
    lastName: "山田",
    reading: "やまだ たろう",
    grade: 3,
    heightCm: 182,
    bodyType: "standard",
    handedness: "right",
    preferredPosition: "OH",
    positionAptitudes: { OH: 80, MB: 40, OP: 60, S: 30, L: 35 },
    abilities: {
      spike: 70,
      jump: 70,
      receive: 65,
      serve: 68,
      set: 40,
      block: 55,
      speed: 65,
      stamina: 70,
      decision: 68,
      mental: 80,
    },
    condition: 70,
    fatigue: 20,
    morale: 80,
    trust: 70,
    academic: 60,
    personalityId: "steady",
    growthTypeId: "standard",
    traitIds: [],
    hiddenTraitIds: [],
    tier: "normal",
    potential: 70,
    trainingEfficiency: 70,
    matchConsistency: 70,
    bigMatch: 70,
    injuryResistance: 70,
    leadership: 90,
    teamAdaptation: 80,
    growthPeakGrade: 2,
    injury: null,
    career: {
      schoolId: schoolId("school-user"),
      enrolledYear: 2026,
      appearances: 0,
      setsPlayed: 0,
      points: 0,
      blocks: 0,
      serviceAces: 0,
      captainSeasons: 0,
      awardIds: [],
      bestTournamentResultId: null,
    },
    ...overrides,
  };
}

function makeDynamics(
  overrides: Partial<TeamDynamicsState> = {},
): TeamDynamicsState {
  return {
    captainPlayerId: playerId("player-a"),
    viceCaptainPlayerId: playerId("player-b"),
    cohesion: 50,
    previousCohesion: 50,
    cohesionTrend: "stable",
    playerRoles: {},
    playerConcerns: {},
    lineupContinuity: 50,
    recentOfficialStarterCounts: {},
    recentOfficialMatchesTracked: 0,
    ...overrides,
  };
}

describe("team dynamics calculations", () => {
  test("leadership suitability follows the approved weighted formula deterministically", () => {
    const player = makePlayer();

    const first = calculateLeadershipSuitability(player);
    const second = calculateLeadershipSuitability(player);

    expect(first).toBe(84);
    expect(second).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(100);
  });

  test("leadership suitability clamps malformed optional inputs to the 0..100 result range", () => {
    const player = makePlayer({
      morale: 500,
      trust: -200,
      leadership: 500,
      teamAdaptation: -100,
      abilities: { ...makePlayer().abilities, mental: 500 },
    });

    expect(calculateLeadershipSuitability(player)).toBe(100);
  });

  test("missing relationship entries are neutral instead of hostile", () => {
    const state = {
      playerRelationships: {},
    } as GameState;

    expect(
      calculateRelationshipSignal(state, [
        playerId("player-a"),
        playerId("player-b"),
      ]),
    ).toBe(50);
  });

  test("relationship signal averages explicit and neutral pair values", () => {
    const state = {
      playerRelationships: {
        "player-a::player-b": 80,
      },
    } as unknown as GameState;

    expect(
      calculateRelationshipSignal(state, [
        playerId("player-a"),
        playerId("player-b"),
        playerId("player-c"),
      ]),
    ).toBe(60);
  });

  test.each([
    [50, 53, "rising"],
    [50, 47, "falling"],
    [50, 52, "stable"],
    [50, 48, "stable"],
  ] as const)(
    "derives cohesion trend from %s to %s as %s",
    (previous, current, expected) => {
      expect(deriveCohesionTrend(previous, current)).toBe(expected);
    },
  );

  test("cohesion target uses the approved weighted factors and remains bounded", () => {
    const playerA = makePlayer();
    const playerB = makePlayer({
      id: playerId("player-b"),
      grade: 2,
      morale: 60,
      trust: 50,
      leadership: 40,
      teamAdaptation: 60,
      abilities: { ...makePlayer().abilities, mental: 60 },
    });
    const state = {
      userSchoolId: schoolId("school-user"),
      schools: {
        "school-user": {
          playerIds: [playerA.id, playerB.id],
        },
      },
      players: {
        [playerA.id]: playerA,
        [playerB.id]: playerB,
      },
      playerRelationships: {
        "player-a::player-b": 70,
      },
    } as unknown as GameState;

    const result = calculateCohesionTarget(
      state,
      makeDynamics({ lineupContinuity: 80 }),
    );

    expect(result).toBe(70);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});
