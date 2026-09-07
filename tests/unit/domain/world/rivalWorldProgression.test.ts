import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import type { HistoricalMatchSummary } from "../../../../src/domain/model/GameState";
import type { Player } from "../../../../src/domain/model/Player";
import type { GameDate } from "../../../../src/domain/model/identifiers";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import {
  MAX_MATCH_HISTORY,
  advanceRivalWorld,
  recordMatchOutcome,
  recordScoutingConflict,
  rivalryKey,
} from "../../../../src/domain/world/rivalWorldProgression";

function abilityTotal(
  player: Player,
  keys: readonly (keyof Player["abilities"])[],
): number {
  return keys.reduce((total, key) => total + player.abilities[key], 0);
}

function abilities(value: number): Player["abilities"] {
  return {
    spike: value,
    jump: value,
    receive: value,
    serve: value,
    set: value,
    block: value,
    speed: value,
    stamina: value,
    decision: value,
    mental: value,
  };
}

describe("rival world progression", () => {
  it("develops rival players toward their school archetype priorities", () => {
    const state = createDemoGame();
    const rival = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    rival.coach.development = 80;
    rival.facilities.trainingRoom = 3;
    const archetype = gameData.schoolArchetypes.get(rival.archetypeId)!;
    const player = state.players[rival.playerIds[0]!]!;
    const priorityKeys = archetype.trainingPriorities;
    const otherKeys = Object.keys(player.abilities).filter(
      (key) => !priorityKeys.includes(key as keyof Player["abilities"]),
    ) as (keyof Player["abilities"])[];
    const priorityBefore = abilityTotal(player, priorityKeys);
    const otherBefore = abilityTotal(player, otherKeys);

    const result = advanceRivalWorld(
      state,
      gameData,
      new SeededRandom("archetype-development"),
    );
    const developed = result.players[player.id]!;
    const priorityGrowth =
      abilityTotal(developed, priorityKeys) - priorityBefore;
    const otherGrowth = abilityTotal(developed, otherKeys) - otherBefore;

    expect(priorityGrowth / priorityKeys.length).toBeGreaterThan(
      otherGrowth / otherKeys.length,
    );
    const userPlayerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    expect(result.players[userPlayerId]!.abilities).toEqual(
      state.players[userPlayerId]!.abilities,
    );
  });

  it("lets established rival schools grow facilities beyond the old Lv5 cap", () => {
    const state = createDemoGame();
    const rival = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    state.schools[rival.id] = {
      ...rival,
      reputation: "elite",
      reputationPoints: 900,
      funds: 1000,
      coach: {
        ...rival.coach,
        development: 100,
        tactics: 100,
        leadership: 100,
        network: 100,
        charisma: 100,
      },
      facilities: {
        ...rival.facilities,
        gym: 5,
        trainingRoom: 5,
        analysisRoom: 5,
        recoveryRoom: 5,
        scoutingNetwork: 5,
      },
      history: {
        ...rival.history,
        recentSeasonRatings: [100, 100],
      },
    };
    for (const playerId of rival.playerIds) {
      state.players[playerId] = {
        ...state.players[playerId]!,
        abilities: abilities(95),
      };
    }

    const result = advanceRivalWorld(
      state,
      gameData,
      new SeededRandom("rival-facility-growth"),
    );
    const facilities = result.schools[rival.id]!.facilities;

    expect(
      Math.max(
        facilities.gym,
        facilities.trainingRoom,
        facilities.analysisRoom,
        facilities.recoveryRoom,
        facilities.scoutingNetwork,
      ),
    ).toBeGreaterThan(5);
  });

  it("never grows rival facilities beyond Lv50", () => {
    const state = createDemoGame();
    const rival = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    state.schools[rival.id] = {
      ...rival,
      reputation: "elite",
      reputationPoints: 1000,
      funds: 2000,
      facilities: {
        ...rival.facilities,
        gym: 50,
        trainingRoom: 50,
        analysisRoom: 50,
        recoveryRoom: 50,
        scoutingNetwork: 50,
      },
      history: {
        ...rival.history,
        recentSeasonRatings: [100, 100],
      },
    };

    const result = advanceRivalWorld(
      state,
      gameData,
      new SeededRandom("rival-facility-cap"),
    );
    const facilities = result.schools[rival.id]!.facilities;

    expect(facilities.gym).toBeLessThanOrEqual(50);
    expect(facilities.trainingRoom).toBeLessThanOrEqual(50);
    expect(facilities.analysisRoom).toBeLessThanOrEqual(50);
    expect(facilities.recoveryRoom).toBeLessThanOrEqual(50);
    expect(facilities.scoutingNetwork).toBeLessThanOrEqual(50);
  });

  it("raises rivalry for close repeated upsets and names a destiny rival", () => {
    let state = createDemoGame();
    const user = state.schools[state.userSchoolId]!;
    const rival = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    user.reputationPoints = 40;
    rival.reputationPoints = 520;

    for (let index = 0; index < 4; index += 1) {
      const summary: HistoricalMatchSummary = {
        matchId: matchId(`rivalry-${index}`),
        date: `2026-${String(index + 5).padStart(2, "0")}-01` as GameDate,
        homeSchoolId: user.id,
        awaySchoolId: rival.id,
        winnerSchoolId: user.id,
        homeSetsWon: 2,
        awaySetsWon: 1,
        tournamentId: index === 3 ? "prefectural-final" : null,
      };
      state = recordMatchOutcome(state, summary);
    }

    expect(
      state.world.rivalryScores[rivalryKey(user.id, rival.id)],
    ).toBeGreaterThanOrEqual(60);
    expect(state.world.destinyRivalSchoolId).toBe(rival.id);
    expect(state.schools[user.id]!.history.officialWins).toBe(1);
    expect(state.schools[rival.id]!.history.officialLosses).toBe(1);
  });

  it("adds scouting conflicts to rivalry and can create a destiny rival", () => {
    let state = createDemoGame();
    const rival = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;

    for (let conflict = 0; conflict < 5; conflict += 1) {
      state = recordScoutingConflict(state, rival.id, 12);
    }

    expect(
      state.world.rivalryScores[rivalryKey(state.userSchoolId, rival.id)],
    ).toBe(60);
    expect(state.world.destinyRivalSchoolId).toBe(rival.id);
  });

  it("does not count the same match twice", () => {
    let state = createDemoGame();
    const user = state.schools[state.userSchoolId]!;
    const rival = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    const summary: HistoricalMatchSummary = {
      matchId: matchId("idempotent-final"),
      date: "2026-08-01",
      homeSchoolId: user.id,
      awaySchoolId: rival.id,
      winnerSchoolId: user.id,
      homeSetsWon: 2,
      awaySetsWon: 1,
      tournamentId: "prefectural-final",
    };

    state = recordMatchOutcome(state, summary);
    const rivalryAfterFirst =
      state.world.rivalryScores[rivalryKey(user.id, rival.id)];
    state = recordMatchOutcome(state, summary);

    expect(state.history.matches).toHaveLength(1);
    expect(state.schools[user.id]!.history.officialWins).toBe(1);
    expect(state.schools[rival.id]!.history.officialLosses).toBe(1);
    expect(state.world.rivalryScores[rivalryKey(user.id, rival.id)]).toBe(
      rivalryAfterFirst,
    );
  });

  it("keeps match history bounded while retaining the newest result", () => {
    let state = createDemoGame();
    const user = state.schools[state.userSchoolId]!;
    const rival = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    state.history.matches = Array.from(
      { length: MAX_MATCH_HISTORY },
      (_, index) => ({
        matchId: matchId(`old-${index}`),
        date: "2026-04-01",
        homeSchoolId: user.id,
        awaySchoolId: rival.id,
        winnerSchoolId: index % 2 === 0 ? user.id : rival.id,
        homeSetsWon: index % 2 === 0 ? 2 : 1,
        awaySetsWon: index % 2 === 0 ? 1 : 2,
        tournamentId: null,
      }),
    );
    const latest: HistoricalMatchSummary = {
      matchId: matchId("latest"),
      date: "2027-03-01",
      homeSchoolId: user.id,
      awaySchoolId: rival.id,
      winnerSchoolId: user.id,
      homeSetsWon: 2,
      awaySetsWon: 0,
      tournamentId: null,
    };

    state = recordMatchOutcome(state, latest);

    expect(state.history.matches).toHaveLength(MAX_MATCH_HISTORY);
    expect(state.history.matches.at(-1)?.matchId).toBe(latest.matchId);
    expect(state.history.matches[0]?.matchId).toBe(matchId("old-1"));
  });
});
