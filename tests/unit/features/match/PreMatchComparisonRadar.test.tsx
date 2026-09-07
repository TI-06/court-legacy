import { render, screen } from "@testing-library/react";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  calculateSelectionStrength,
  selectPracticeOpponent,
} from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PreMatchComparison } from "../../../../src/features/match/MatchStatPanels";

describe("PreMatchComparison radar", () => {
  it("compares both teams on the approved five volleyball axes with A-G grades", () => {
    const state = createDemoGame();
    const homeSelection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const opponent = selectPracticeOpponent(state);
    const awaySelection = autoSelectTeam({ state, schoolId: opponent.id });

    render(
      <PreMatchComparison
        awaySelection={awaySelection}
        awayStrength={calculateSelectionStrength(state, awaySelection)}
        homeSelection={homeSelection}
        homeStrength={calculateSelectionStrength(state, homeSelection)}
        state={state}
      />,
    );

    expect(
      screen.getByRole("img", { name: "自校と相手の5項目戦力比較" }),
    ).toBeVisible();
    for (const label of ["攻撃", "ブロック", "サーブ", "レシーブ", "連携"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText("スタミナ")).toBeNull();
    expect(screen.getAllByText(/^[A-G]$/).length).toBeGreaterThanOrEqual(10);
  });
});
