import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { calculateSelectionStrength } from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { HomeScreen } from "../../../../src/features/home/HomeScreen";

describe("HomeScreen practice schedule", () => {
  it("does not invent a fallback practice opponent when no match is scheduled", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.scheduledOpponentId = null;
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    const homeSelection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const homeStrength = calculateSelectionStrength(state, homeSelection);

    render(
      <HomeScreen
        data={gameData}
        homeStrength={homeStrength}
        onAdvanceWeek={vi.fn()}
        onCommand={vi.fn()}
        onMarkNotificationRead={vi.fn()}
        state={state}
      />,
    );

    expect(screen.getByTestId("home-command-summary")).toBeVisible();
    const teamStatus = screen.getByRole("region", { name: "チーム状況" });
    expect(within(teamStatus).getByText(String(homeStrength))).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "練習試合 試合" }),
    ).toBeNull();
    expect(screen.queryByText("対戦相手 未決定")).toBeNull();
  });
});
