import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import type { ConcernResolutionNotification } from "../../../../src/domain/notifications/gameNotifications";
import { selectHomeCommandCenter } from "../../../../src/features/home/homeCommandCenter";
import { TeamDynamicsPanel } from "../../../../src/features/team/TeamDynamicsPanel";

describe("Phase20 player concern guidance UX", () => {
  it("shows the reason, concrete resolution path, progress, and status in Team dynamics", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    state.teamDynamics.recentOfficialMatchesTracked = 4;
    state.teamDynamics.recentOfficialStarterCounts[playerId] = 0;
    state.teamDynamics.playerConcerns[playerId] = [
      { code: "playing-time", severity: 3 },
    ];

    render(
      <TeamDynamicsPanel
        state={state}
        pending={false}
        onAssignLeadership={vi.fn()}
      />,
    );

    const concernSection = screen.getByRole("heading", {
      name: "気になる選手",
    }).parentElement?.parentElement;
    expect(concernSection).not.toBeNull();
    const scope = within(concernSection!);
    expect(scope.getByText(/出場機会への不満/)).toBeVisible();
    expect(scope.getByText(/直近4試合/)).toBeVisible();
    expect(scope.getByText(/直近公式戦の起用 0\/4/)).toBeVisible();
    expect(scope.getByText(/公式戦で起用を増やす/)).toBeVisible();
    expect(scope.getByText("対応が必要")).toBeVisible();
    expect(scope.getByText(new RegExp(player.lastName))).toBeVisible();
  });

  it("shows improving when the current concern has measurable progress", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.teamDynamics.recentOfficialMatchesTracked = 4;
    state.teamDynamics.recentOfficialStarterCounts[playerId] = 1;
    state.teamDynamics.playerConcerns[playerId] = [
      { code: "playing-time", severity: 2 },
    ];

    render(
      <TeamDynamicsPanel
        state={state}
        pending={false}
        onAssignLeadership={vi.fn()}
      />,
    );

    expect(screen.getByText("改善中")).toBeVisible();
    expect(screen.getByText(/直近公式戦の起用 1\/4/)).toBeVisible();
  });

  it("uses the same actionable guidance in the Home concern task", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.teamDynamics.recentOfficialMatchesTracked = 4;
    state.teamDynamics.recentOfficialStarterCounts[playerId] = 0;
    state.teamDynamics.playerConcerns[playerId] = [
      { code: "playing-time", severity: 3 },
    ];

    const model = selectHomeCommandCenter({
      state,
      data: gameData,
      homeStrength: 60,
    });
    const task = model.tasks.find((candidate) =>
      candidate.id.startsWith(`player-concern:${playerId}:`),
    );

    expect(task?.detail).toContain("出場機会への不満");
    expect(task?.detail).toContain("0/4");
    expect(task?.detail).toContain("公式戦で起用を増やす");
  });

  it("surfaces the latest concern-resolution notification as Home news", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const notification: ConcernResolutionNotification = {
      id: "concern-resolution:phase20-home-news",
      type: "concern-resolution",
      createdGameDate: state.date,
      academicYearIndex: state.yearIndex,
      weekOfYear: state.calendar.weekOfYear,
      readAtGameDate: null,
      payload: {
        items: [
          {
            playerId,
            displayName: `${player.lastName} ${player.firstName}`,
            concernCode: "playing-time",
            concernTitle: "出場機会への不満",
          },
        ],
      },
    };
    state.notifications.items = [notification];

    const model = selectHomeCommandCenter({
      state,
      data: gameData,
      homeStrength: 60,
    });
    const news = model.news.find(
      (candidate) => candidate.id === `news:concern:${notification.id}`,
    );

    expect(news).toMatchObject({
      kind: "concern-resolution",
      title: "選手の不満が解消",
    });
    expect(news?.detail).toContain(`${player.lastName} ${player.firstName}`);
    expect(news?.detail).toContain("出場機会への不満");
  });
});
