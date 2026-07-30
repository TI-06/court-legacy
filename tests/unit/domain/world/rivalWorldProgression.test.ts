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
  rivalryKey,
} from "../../../../src/domain/world/rivalWorldProgression";

function abilityTotal(
  player: Player,
  keys: readonly (keyof Player["abilities"])[],
): number {
  return keys.reduce((total, key) => total + player.abilities[key], 0);
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
