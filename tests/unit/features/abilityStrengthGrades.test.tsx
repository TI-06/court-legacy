import { fireEvent, render, screen, within } from "@testing-library/react";
import { createDemoGame } from "../../../src/app/createDemoGame";
import {
  calculateSelectionStrength,
  selectPracticeOpponent,
} from "../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import { PreMatchComparison } from "../../../src/features/match/MatchStatPanels";
import { PlayerHubScreen } from "../../../src/features/team/PlayerHubScreen";

describe("ability and school strength grades", () => {
  it("shows each player ability summary as an A-G grade", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;
    const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });

    render(
      <PlayerHubScreen
        onAssignLeadership={vi.fn()}
        onChange={vi.fn()}
        selection={selection}
        state={state}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: `選手詳細 ${player.lastName} ${player.firstName}`,
      }),
    );

    const abilityRegion = screen.getByRole("region", { name: "選手能力" });
    const abilityBars = within(abilityRegion).getAllByRole("progressbar");
    expect(abilityBars).toHaveLength(5);

    for (const bar of abilityBars) {
      const row = bar.closest(".game-stat-bar");
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).getByText(/^[A-G]$/)).toBeVisible();
    }
  });

  it("shows the five-category overall values and A-F school evaluations before a match", () => {
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

    expect(screen.getByText("5項目総合")).toBeVisible();
    expect(screen.getAllByText(/学校評価 [A-F]/)).toHaveLength(2);
  });
});
