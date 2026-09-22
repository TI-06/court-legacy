import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { markWeeklyActionCompleted } from "../../../../src/domain/calendar/weekProgression";
import { simulateMatch } from "../../../../src/domain/match/simulateMatch";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PracticeMatchReviewPanel } from "../../../../src/features/match/PracticeMatchReviewPanel";

function fixture() {
  const state = createDemoGame();
  const opponent = selectPracticeOpponent(state);
  const result = simulateMatch({
    state,
    id: matchId("phase29-5-review-panel"),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponent.id,
    homeSelection: autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    }),
    awaySelection: autoSelectTeam({
      state,
      schoolId: opponent.id,
    }),
    bestOfSets: 3,
    random: new SeededRandom("phase29-5-review-panel"),
  });

  return { state, match: result.match };
}

describe("PracticeMatchReviewPanel", () => {
  it("applies the recommended team training in one tap", () => {
    const { state, match } = fixture();
    const onApplyTrainingRecommendation = vi.fn();

    render(
      <PracticeMatchReviewPanel
        awayStrength={72}
        homeStrength={66}
        match={match}
        onApplyTrainingRecommendation={onApplyTrainingRecommendation}
        state={state}
      />,
    );

    const recommendation = screen.getByRole("region", {
      name: "練習試合後の重点練習",
    });
    expect(within(recommendation).getByText("NEXT TRAINING")).toBeVisible();

    fireEvent.click(
      within(recommendation).getByRole("button", {
        name: "この練習を設定",
      }),
    );

    expect(onApplyTrainingRecommendation).toHaveBeenCalledTimes(1);
    expect(onApplyTrainingRecommendation).toHaveBeenCalledWith(
      expect.stringMatching(/^training\./),
    );
  });

  it("keeps the recommendation visible but disables overwriting completed training", () => {
    const fixtureValue = fixture();
    const state = markWeeklyActionCompleted(fixtureValue.state, "training");
    const onApplyTrainingRecommendation = vi.fn();

    render(
      <PracticeMatchReviewPanel
        awayStrength={72}
        homeStrength={66}
        match={fixtureValue.match}
        onApplyTrainingRecommendation={onApplyTrainingRecommendation}
        state={state}
      />,
    );

    const recommendation = screen.getByRole("region", {
      name: "練習試合後の重点練習",
    });
    const button = within(recommendation).getByRole("button", {
      name: "今週の練習は実施済み",
    });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onApplyTrainingRecommendation).not.toHaveBeenCalled();
  });
});
