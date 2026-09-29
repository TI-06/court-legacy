import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import {
  applyPlayerOpportunityResponses,
  resolveCompletedMatchOpportunityPromises,
  selectActivePlayerOpportunityPromises,
} from "../../../src/domain/dynamics/playerOpportunityPromises";
import type { MatchState } from "../../../src/domain/model/Match";
import { matchId } from "../../../src/domain/model/identifiers";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";

describe("player opportunity promises", () => {
  it("rewards a fulfilled starter promise", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const playerId = selection.rotation[0]!.playerId;
    const before = state.players[playerId]!;
    const next = applyPlayerOpportunityResponses(state, selection, [
      { playerId, choice: "starter" },
    ]);

    expect(next.players[playerId]!.trust).toBe(
      Math.min(100, before.trust + 3),
    );
    expect(next.players[playerId]!.morale).toBe(
      Math.min(100, before.morale + 2),
    );
    expect(selectActivePlayerOpportunityPromises(next)).toEqual([]);
  });

  it(
    "keeps a substitute promise active until the player enters the match",
    () => {
      const state = createDemoGame();
      const selection = autoSelectTeam({
        state,
        schoolId: state.userSchoolId,
      });
      const playerId = selection.benchPlayerIds[0]!;
      const promised = applyPlayerOpportunityResponses(state, selection, [
        { playerId, choice: "substitute" },
      ]);

      expect(selectActivePlayerOpportunityPromises(promised)).toEqual([
        { playerId, choice: "substitute" },
      ]);

      const match = {
        id: matchId("promise-test"),
        homeSchoolId: state.userSchoolId,
        awaySchoolId: Object.values(state.schools).find(
          (school) => school.id !== state.userSchoolId,
        )!.id,
        homeSelection: selection,
        awaySelection: selection,
        eventLog: [
          {
            sequence: 1,
            type: "substitution",
            setNumber: 1,
            homeScore: 10,
            awayScore: 5,
            actorPlayerId: playerId,
            targetPlayerId: selection.rotation[0]!.playerId,
            winnerSchoolId: state.userSchoolId,
            detailCode: "substitution.coach-command",
          },
        ],
      } as MatchState;

      const resolved = resolveCompletedMatchOpportunityPromises(
        promised,
        match,
      );
      expect(selectActivePlayerOpportunityPromises(resolved)).toEqual([]);
      expect(resolved.players[playerId]!.trust).toBe(
        Math.min(100, state.players[playerId]!.trust + 3),
      );
    },
  );

  it(
    "promotes a next-match promise to a starter promise after the current match",
    () => {
      const state = createDemoGame();
      const selection = autoSelectTeam({
        state,
        schoolId: state.userSchoolId,
      });
      const playerId = selection.benchPlayerIds[0]!;
      const promised = applyPlayerOpportunityResponses(state, selection, [
        { playerId, choice: "next-match" },
      ]);

      const match = {
        id: matchId("promise-next-match"),
        homeSchoolId: state.userSchoolId,
        awaySchoolId: Object.values(state.schools).find(
          (school) => school.id !== state.userSchoolId,
        )!.id,
        homeSelection: selection,
        awaySelection: selection,
        eventLog: [],
      } as MatchState;

      const resolved = resolveCompletedMatchOpportunityPromises(
        promised,
        match,
      );
      expect(selectActivePlayerOpportunityPromises(resolved)).toEqual([
        { playerId, choice: "starter" },
      ]);
    },
  );
});
