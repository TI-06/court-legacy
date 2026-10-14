import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { HomeScreen } from "../../../../src/features/home/HomeScreen";

function renderHomeWithAssignments(assignAllPlayers: boolean) {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  state.weeklySchedule.practiceMatch.incomingOffer = null;

  state.weeklySchedule.trainingPlan = {
    teamTrainingMenuId: "training.spike",
    individualAssignments: school.playerIds
      .slice(0, assignAllPlayers ? school.playerIds.length : -1)
      .map((playerId, index) => ({
        playerId,
        instructionId:
          index < 2
            ? "instruction.attack"
            : index < 5
              ? "instruction.defense"
              : "instruction.overall",
      })),
  };

  render(
    <HomeScreen
      data={gameData}
      homeStrength={8120}
      onAdvanceWeek={vi.fn()}
      onCommand={vi.fn()}
      onMarkNotificationRead={vi.fn()}
      state={state}
    />,
  );

  return { state, school };
}

describe("Phase22 Home individual training summary", () => {
  it("groups configured individual menus instead of presenting the legacy team menu as the weekly training", () => {
    renderHomeWithAssignments(true);
    fireEvent.click(
      screen.getByRole("button", { name: "やることをすべて見る" }),
    );
    const tasks = screen.getByRole("dialog", { name: "今週やること" });

    expect(within(tasks).getByText(/攻撃 2名/)).toBeVisible();
    expect(within(tasks).getByText(/守備 3名/)).toBeVisible();
    expect(within(tasks).getByText(/全体 \d+名/)).toBeVisible();
    expect(screen.queryByText("スパイク練習")).toBeNull();
    expect(screen.queryByRole("button", { name: /個人練習を設定/ })).toBeNull();
  });

  it("shows a setup action only while at least one roster player is truly unconfigured", () => {
    const { school } = renderHomeWithAssignments(false);
    fireEvent.click(
      screen.getByRole("button", { name: "やることをすべて見る" }),
    );
    const tasks = screen.getByRole("dialog", { name: "今週やること" });

    expect(within(tasks).getByText(/未設定 1名/)).toBeVisible();
    expect(
      within(tasks).getByText(
        new RegExp(
          `設定済み ${school.playerIds.length - 1}/${school.playerIds.length}名`,
        ),
      ),
    ).toBeVisible();
    expect(
      within(tasks).getByRole("button", { name: /個人練習を設定/ }),
    ).toBeVisible();
  });
});
