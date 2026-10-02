import { createDemoGame } from "../../../../src/app/createDemoGame";
import { simulateMatch } from "../../../../src/domain/match/simulateMatch";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import {
  calculateSelectionStrength,
  selectPracticeOpponent,
} from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { buildMatchReviewEvaluation } from "../../../../src/features/match/matchReviewEvaluation";
import { buildMatchStatSummary } from "../../../../src/features/match/matchPresentation";

function completedFixture() {
  const state = createDemoGame();
  const opponent = selectPracticeOpponent(state);
  const homeSelection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const awaySelection = autoSelectTeam({
    state,
    schoolId: opponent.id,
  });
  const result = simulateMatch({
    state,
    id: matchId("phase53-result-review"),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponent.id,
    homeSelection,
    awaySelection,
    bestOfSets: 3,
    random: new SeededRandom("phase53-result-review"),
  });

  return {
    state,
    result,
    homeStrength: calculateSelectionStrength(state, homeSelection),
    awayStrength: calculateSelectionStrength(state, awaySelection),
  };
}

describe("Phase53 match review evaluation", () => {
  it("produces bounded team and position-aware player ratings for the user school", () => {
    const fixture = completedFixture();
    const summary = buildMatchStatSummary(fixture.state, fixture.result.match);
    const evaluation = buildMatchReviewEvaluation({
      match: fixture.result.match,
      summary,
      userSchoolId: fixture.state.userSchoolId,
      homeStrength: fixture.homeStrength,
      awayStrength: fixture.awayStrength,
    });

    expect(evaluation.team.score).toBeGreaterThanOrEqual(20);
    expect(evaluation.team.score).toBeLessThanOrEqual(100);
    for (const category of [
      evaluation.team.attack,
      evaluation.team.block,
      evaluation.team.serve,
      evaluation.team.receive,
    ]) {
      expect(category.score).toBeGreaterThanOrEqual(20);
      expect(category.score).toBeLessThanOrEqual(100);
    }

    const userPlayerIds = new Set(
      summary.players
        .filter((player) => player.schoolId === fixture.state.userSchoolId)
        .map((player) => player.playerId),
    );
    expect(evaluation.teamMvpPlayerId).not.toBeNull();
    expect(userPlayerIds.has(evaluation.teamMvpPlayerId!)).toBe(true);
    expect(evaluation.players).toHaveLength(userPlayerIds.size);
  });

  it("does not assign a fake poor grade to a player with no observed activity", () => {
    const fixture = completedFixture();
    const summary = buildMatchStatSummary(fixture.state, fixture.result.match);
    const userPlayer = summary.players.find(
      (player) => player.schoolId === fixture.state.userSchoolId,
    );
    if (!userPlayer) throw new Error("user player fixture missing");

    const quietSummary = structuredClone(summary);
    const quietPlayer = quietSummary.players.find(
      (player) => player.playerId === userPlayer.playerId,
    );
    if (!quietPlayer) throw new Error("quiet player fixture missing");
    quietPlayer.points = 0;
    quietPlayer.attackPoints = 0;
    quietPlayer.blockPoints = 0;
    quietPlayer.serviceAces = 0;
    quietPlayer.defensePoints = 0;
    quietPlayer.attackAttempts = 0;
    quietPlayer.receiveAttempts = 0;
    quietPlayer.perfectReceives = 0;
    quietPlayer.attackSuccessRate = 0;
    quietPlayer.perfectReceiveRate = 0;

    const evaluation = buildMatchReviewEvaluation({
      match: fixture.result.match,
      summary: quietSummary,
      userSchoolId: fixture.state.userSchoolId,
      homeStrength: fixture.homeStrength,
      awayStrength: fixture.awayStrength,
    });
    const quietEvaluation = evaluation.players.find(
      (player) => player.playerId === userPlayer.playerId,
    );

    expect(quietEvaluation).toEqual({
      playerId: userPlayer.playerId,
      rated: false,
      score: null,
      grade: null,
    });
  });
});
