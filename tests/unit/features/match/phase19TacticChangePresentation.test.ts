import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { MatchEvent, MatchState } from "../../../../src/domain/model/Match";
import { matchId } from "../../../../src/domain/model/identifiers";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { presentMatchEvent } from "../../../../src/features/match/matchPresentation";

describe("Phase19-4 tactic change presentation", () => {
  it("shows a compact public opponent tactic change without exposing the raw detail code", () => {
    const state = createDemoGame();
    const opponent = selectPracticeOpponent(state);
    const homeSelection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const awaySelection = autoSelectTeam({ state, schoolId: opponent.id });
    const match: MatchState = {
      id: matchId("phase19-tactic-presentation"),
      homeSchoolId: state.userSchoolId,
      awaySchoolId: opponent.id,
      homeSelection,
      awaySelection,
      bestOfSets: 3,
      phase: "set-in-progress",
      currentSetNumber: 2,
      homeSetsWon: 1,
      awaySetsWon: 0,
      sets: [],
      servingSchoolId: state.userSchoolId,
      pendingCoachCommandForSchoolId: null,
      eventLog: [],
      randomSeed: state.seed,
      randomCursor: 0,
    };
    const event: MatchEvent = {
      sequence: 18,
      type: "tactic-change",
      setNumber: 2,
      homeScore: 0,
      awayScore: 0,
      actorPlayerId: null,
      targetPlayerId: null,
      winnerSchoolId: opponent.id,
      detailCode: "tactic.automatic.aggressive.quick.commit",
    };

    const presented = presentMatchEvent(event, { state, match });

    expect(presented.title).toBe("相手戦術変更");
    expect(presented.detail).toContain(opponent.name);
    expect(presented.detail).toContain("速攻重視へ変更");
    expect(presented.detail).not.toContain("tactic.automatic");
  });
});
