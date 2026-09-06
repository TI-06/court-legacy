import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { calculateSelectionStrength, selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { HomeScreen } from "../../../../src/features/home/HomeScreen";

describe("HomeScreen practice schedule", () => {
  it("does not show a fallback opponent when no practice match is scheduled", () => {
    const state = createDemoGame();
    const opponent = selectPracticeOpponent(state);
    state.weeklySchedule.practiceMatch.scheduledOpponentId = null;
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    const homeSelection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });

    render(
      <HomeScreen
        state={state}
        opponent={opponent}
        latestMatch={null}
        homeStrength={calculateSelectionStrength(state, homeSelection)}
        trainingCompleted={false}
        practiceMatchCompleted={false}
        onOpenTeam={vi.fn()}
        onOpenMatch={vi.fn()}
        onOpenOfficialTournament={vi.fn()}
        onAdvanceWeek={vi.fn()}
        onMarkNotificationRead={vi.fn()}
      />,
    );

    expect(screen.getByText("対戦相手 未決定")).toBeVisible();
    expect(screen.queryByLabelText("対戦戦力")).toBeNull();
    expect(screen.queryByTitle(opponent.name)).toBeNull();
    expect(screen.getByText("未決定")).toBeVisible();
  });
});
