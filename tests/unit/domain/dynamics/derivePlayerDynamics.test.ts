import { describe, expect, test } from "vitest";
import type { GameState } from "../../../../src/domain/model/GameState";
import type { Player } from "../../../../src/domain/model/Player";
import type { TeamSelection } from "../../../../src/domain/model/TeamSelection";
import {
  matchId,
  playerId,
  schoolId,
  type PlayerId,
} from "../../../../src/domain/model/identifiers";
import {
  calculateLineupContinuity,
  derivePlayerConcerns,
  derivePlayerRoles,
  updateRecentOfficialUsage,
} from "../../../../src/domain/dynamics/derivePlayerDynamics";
import type {
  PlayerRole,
  TeamDynamicsState,
} from "../../../../src/domain/dynamics/teamDynamicsTypes";

const USER_SCHOOL_ID = schoolId("school-user");
const OTHER_SCHOOL_ID = schoolId("school-other");

function makePlayer(
  id: string,
  power: number,
  overrides: Partial<Player> = {},
): Player {
  const normalized = Math.max(0, Math.min(100, power));
  return {
    id: playerId(id),
    firstName: id,
    lastName: "選手",
    reading: id,
    grade: 3,
    heightCm: 180,
    bodyType: "standard",
    handedness: "right",
    preferredPosition: "OH",
    positionAptitudes: { OH: 80, MB: 50, OP: 60, S: 40, L: 40 },
    abilities: {
      spike: normalized,
      jump: normalized,
      receive: normalized,
      serve: normalized,
      set: normalized,
      block: normalized,
      speed: normalized,
      stamina: normalized,
      decision: normalized,
      mental: normalized,
    },
    condition: 70,
    fatigue: 20,
    morale: 60,
    trust: 60,
    academic: 60,
    personalityId: "steady",
    growthTypeId: "standard",
    traitIds: [],
    hiddenTraitIds: [],
    tier: "normal",
    potential: normalized,
    trainingEfficiency: 60,
    matchConsistency: 60,
    bigMatch: 60,
    injuryResistance: 60,
    leadership: 60,
    teamAdaptation: 60,
    growthPeakGrade: 2,
    injury: null,
    career: {
      schoolId: USER_SCHOOL_ID,
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

function makeSelection(starterIds: readonly PlayerId[]): TeamSelection {
  const rotationIds = starterIds.slice(0, 6);
  if (rotationIds.length !== 6) {
    throw new Error("test selection requires six rotation players");
  }

  return {
    rotation: rotationIds.map((id, index) => ({
      slot: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6,
      playerId: id,
    })),
    liberoPlayerId: starterIds[6] ?? null,
    benchPlayerIds: [],
    servingOrderPlayerIds: [...rotationIds],
    substitutionPolicy: {
      starterLockPlayerIds: [],
      allowFatigueBenching: true,
      allowInjuryBenching: true,
      automaticSubstitutions: true,
      automaticSetChanges: true,
    },
  };
}

function makeDynamics(
  overrides: Partial<TeamDynamicsState> = {},
): TeamDynamicsState {
  return {
    captainPlayerId: null,
    viceCaptainPlayerId: null,
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

function makeState(
  players: readonly Player[],
  historyMatches: GameState["history"]["matches"] = [],
): GameState {
  return {
    userSchoolId: USER_SCHOOL_ID,
    schools: {
      [USER_SCHOOL_ID]: {
        id: USER_SCHOOL_ID,
        playerIds: players.map((player) => player.id),
      },
    },
    players: Object.fromEntries(players.map((player) => [player.id, player])),
    history: { matches: historyMatches },
  } as unknown as GameState;
}

function makeRoster(): Player[] {
  return [
    makePlayer("player-a", 90),
    makePlayer("player-b", 85),
    makePlayer("player-c", 80),
    makePlayer("player-d", 75),
    makePlayer("player-e", 70),
    makePlayer("player-f", 65),
    makePlayer("player-g", 60),
    makePlayer("player-h", 58, { grade: 2, potential: 75 }),
    makePlayer("player-i", 45, { grade: 1, potential: 70 }),
    makePlayer("player-j", 40, { grade: 3, potential: 45 }),
  ];
}

describe("derivePlayerRoles", () => {
  test("equal-power players use player id as the stable ace tie breaker", () => {
    const playerB = makePlayer("player-b", 90);
    const playerA = makePlayer("player-a", 90);
    const otherPlayers = [
      makePlayer("player-c", 70),
      makePlayer("player-d", 69),
      makePlayer("player-e", 68),
      makePlayer("player-f", 67),
      makePlayer("player-g", 66),
    ];
    const players = [playerB, playerA, ...otherPlayers];
    const state = makeState(players);
    const selection = makeSelection(
      players.slice(0, 7).map((player) => player.id),
    );

    const roles = derivePlayerRoles({
      state,
      selection,
      dynamics: makeDynamics(),
    });

    expect(roles[playerA.id]).toBe("ace");
    expect(roles[playerB.id]).toBe("starter");
  });

  test("classifies current unit, strong bench, young prospects, and reserves", () => {
    const players = makeRoster();
    const state = makeState(players);
    const selection = makeSelection(
      [
        players[0]!,
        players[1]!,
        players[2]!,
        players[3]!,
        players[4]!,
        players[5]!,
        players[7]!,
      ].map((player) => player.id),
    );

    const roles = derivePlayerRoles({
      state,
      selection,
      dynamics: makeDynamics({
        recentOfficialMatchesTracked: 4,
        recentOfficialStarterCounts: { [players[8]!.id]: 1 },
      }),
    });

    expect(roles[players[0]!.id]).toBe("ace");
    expect(roles[players[1]!.id]).toBe("starter");
    expect(roles[players[6]!.id]).toBe("rotation");
    expect(roles[players[8]!.id]).toBe("rotation");
    expect(roles[players[7]!.id]).toBe("starter");
    expect(roles[players[9]!.id]).toBe("reserve");
  });

  test("classifies unused young players with future value as development", () => {
    const players = makeRoster();
    const state = makeState(players);
    const selection = makeSelection(
      players.slice(0, 7).map((player) => player.id),
    );

    const roles = derivePlayerRoles({
      state,
      selection,
      dynamics: makeDynamics(),
    });

    expect(roles[players[8]!.id]).toBe("development");
  });
});

describe("recent official usage", () => {
  test("keeps the usage signal bounded to eight tracked matches", () => {
    const starters = Array.from({ length: 7 }, (_, index) =>
      playerId(`starter-${index + 1}`),
    );
    let dynamics = makeDynamics();

    for (let index = 0; index < 10; index += 1) {
      dynamics = updateRecentOfficialUsage(dynamics, starters);
    }

    expect(dynamics.recentOfficialMatchesTracked).toBe(8);
    for (const starter of starters) {
      expect(dynamics.recentOfficialStarterCounts[starter]).toBeLessThanOrEqual(
        8,
      );
      expect(dynamics.recentOfficialStarterCounts[starter]).toBeGreaterThan(0);
    }
  });

  test("lineup continuity is neutral without history and reflects repeated starters", () => {
    const starters = Array.from({ length: 7 }, (_, index) =>
      playerId(`starter-${index + 1}`),
    );

    expect(calculateLineupContinuity(makeDynamics(), starters)).toBe(50);

    const dynamics = makeDynamics({
      recentOfficialMatchesTracked: 4,
      recentOfficialStarterCounts: Object.fromEntries(
        starters.map((id) => [id, 3]),
      ),
    });

    expect(calculateLineupContinuity(dynamics, starters)).toBe(75);
  });
});

describe("derivePlayerConcerns", () => {
  test("flags strong expected starters with materially low recent usage", () => {
    const players = makeRoster();
    const state = makeState(players);
    const roles: Partial<Record<PlayerId, PlayerRole>> = {
      [players[0]!.id]: "ace",
      [players[1]!.id]: "starter",
    };

    const concerns = derivePlayerConcerns(
      state,
      roles,
      makeDynamics({
        recentOfficialMatchesTracked: 4,
        recentOfficialStarterCounts: { [players[1]!.id]: 1 },
      }),
    );

    expect(concerns[players[0]!.id]).toContainEqual({
      code: "playing-time",
      severity: 3,
    });
    expect(concerns[players[1]!.id]).toContainEqual({
      code: "playing-time",
      severity: 2,
    });
  });

  test("flags a top-seven player held below the first unit as role mismatch", () => {
    const players = makeRoster();
    const state = makeState(players);
    const roles: Partial<Record<PlayerId, PlayerRole>> = {
      [players[2]!.id]: "rotation",
    };

    const concerns = derivePlayerConcerns(
      state,
      roles,
      makeDynamics({ recentOfficialMatchesTracked: 3 }),
    );

    expect(concerns[players[2]!.id]).toContainEqual({
      code: "role-mismatch",
      severity: 2,
    });
  });

  test("flags injured players who still have recent official usage", () => {
    const injured = makePlayer("player-injured", 70, {
      injury: {
        injuryId: "injury-1",
        severity: "moderate",
        remainingWeeks: 2,
        recurrenceRisk: 20,
      },
    });
    const state = makeState([injured]);

    const concerns = derivePlayerConcerns(
      state,
      { [injured.id]: "starter" },
      makeDynamics({
        recentOfficialMatchesTracked: 2,
        recentOfficialStarterCounts: { [injured.id]: 1 },
      }),
    );

    expect(concerns[injured.id]).toContainEqual({
      code: "injury-overuse",
      severity: 2,
    });
  });

  test("adds team slump after the latest three official matches are losses", () => {
    const players = makeRoster();
    const losses: GameState["history"]["matches"] = [1, 2, 3].map((index) => ({
      matchId: matchId(`official-${index}`),
      date: `2026-0${index + 4}-01` as GameState["date"],
      homeSchoolId: USER_SCHOOL_ID,
      awaySchoolId: OTHER_SCHOOL_ID,
      winnerSchoolId: OTHER_SCHOOL_ID,
      homeSetsWon: 0,
      awaySetsWon: 2,
      tournamentId: `official-${index}`,
    }));
    const state = makeState(players, losses);

    const concerns = derivePlayerConcerns(state, {}, makeDynamics());

    expect(concerns[players[0]!.id]).toContainEqual({
      code: "team-slump",
      severity: 1,
    });
    expect(Object.keys(concerns)).toHaveLength(players.length);
  });
});
