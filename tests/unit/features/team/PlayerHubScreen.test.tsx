import { fireEvent, render, screen, within } from "@testing-library/react";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { getPlayerConditionPresentation } from "../../../../src/domain/player/playerCondition";
import { getPlayerDevelopmentPresentation } from "../../../../src/domain/player/playerDevelopmentPresentation";
import { calculatePlayerDisplayPower } from "../../../../src/domain/selectors/playerPresentation";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PlayerHubScreen } from "../../../../src/features/team/PlayerHubScreen";

interface RenderOptions {
  onSetDevelopmentPriorities?: (playerIds: string[]) => void;
  planningPending?: boolean;
}

function renderPlayerHub(
  state = createDemoGame(),
  onAssignLeadership = vi.fn(),
  options: RenderOptions = {},
) {
  const selection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const onSetDevelopmentPriorities =
    options.onSetDevelopmentPriorities ?? vi.fn();
  const view = render(
    <PlayerHubScreen
      onAssignLeadership={onAssignLeadership}
      onChange={vi.fn()}
      onSetDevelopmentPriorities={onSetDevelopmentPriorities}
      planningPending={options.planningPending}
      selection={selection}
      state={state}
    />,
  );

  return {
    state,
    selection,
    view,
    onAssignLeadership,
    onSetDevelopmentPriorities,
  };
}

describe("PlayerHubScreen", () => {
  it("renders a dense portrait-free mobile roster with growth and talent labels", () => {
    const { state, view } = renderPlayerHub();
    const school = state.schools[state.userSchoolId]!;
    const player = school.playerIds
      .map((id) => state.players[id]!)
      .sort(
        (left, right) =>
          calculatePlayerDisplayPower(right) -
            calculatePlayerDisplayPower(left) ||
          left.id.localeCompare(right.id),
      )[0]!;
    const condition = getPlayerConditionPresentation(player.condition);
    const development = getPlayerDevelopmentPresentation(player);
    const rows = screen.getAllByTestId("roster-player-row");

    expect(rows).toHaveLength(school.playerIds.length);
    expect(view.container.querySelector("img")).toBeNull();
    expect(screen.getByText("登録選手")).toBeVisible();
    expect(view.container.querySelector(".player-roster__header")).toBeNull();
    expect(screen.queryByText("PLAYER ROSTER")).toBeNull();

    const firstRow = rows[0]!;
    expect(within(firstRow).getByText("1")).toBeVisible();
    expect(
      within(firstRow).getByText(`${player.lastName} ${player.firstName}`),
    ).toBeVisible();
    expect(
      within(firstRow).getByText(
        `${player.grade}年・${player.preferredPosition}・${player.heightCm}cm`,
      ),
    ).toBeVisible();
    expect(
      within(firstRow).getByText(
        `${development.growthLabel}・${development.talentLabel}`,
      ),
    ).toBeVisible();
    expect(within(firstRow).getByText("総合")).toBeVisible();
    expect(
      within(firstRow).getByText(
        String(Math.round(calculatePlayerDisplayPower(player) / 100)),
      ),
    ).toBeVisible();
    expect(within(firstRow).getByTitle(condition.label)).toBeVisible();
    expect(within(firstRow).getByText(condition.label)).toBeVisible();
    expect(within(firstRow).getByText("4週 --")).toBeVisible();
  });

  it("filters the roster and exposes all required sort options", () => {
    const { state } = renderPlayerHub();
    const school = state.schools[state.userSchoolId]!;
    const expectedGradeOne = school.playerIds.filter(
      (id) => state.players[id]!.grade === 1,
    ).length;

    const filter = screen.getByLabelText("選手絞り込み");
    const sort = screen.getByLabelText("並び替え");

    expect(within(filter).getByRole("option", { name: "全員" })).toBeVisible();
    for (const label of [
      "1年",
      "2年",
      "3年",
      "OH",
      "MB",
      "OP",
      "S",
      "L",
      "スタメン",
      "控え",
      "重点育成",
      "怪我中",
    ]) {
      expect(within(filter).getByRole("option", { name: label })).toBeVisible();
    }
    for (const label of [
      "総合力順",
      "将来性順",
      "調子順",
      "直近4週の成長順",
      "学年順",
    ]) {
      expect(within(sort).getByRole("option", { name: label })).toBeVisible();
    }

    fireEvent.change(filter, { target: { value: "grade-1" } });
    expect(screen.getAllByTestId("roster-player-row")).toHaveLength(
      expectedGradeOne,
    );
    expect(
      screen.getByText(
        `表示 ${expectedGradeOne} / 全 ${school.playerIds.length}人`,
      ),
    ).toBeVisible();
  });

  it("shows the empty filtered state without changing the full roster count", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    for (const playerId of school.playerIds) {
      state.players[playerId]!.injury = null;
    }
    renderPlayerHub(state);

    fireEvent.change(screen.getByLabelText("選手絞り込み"), {
      target: { value: "injured" },
    });

    expect(screen.queryAllByTestId("roster-player-row")).toHaveLength(0);
    expect(screen.getByText("条件に該当する選手はいません")).toBeVisible();
    expect(
      screen.getByText(`表示 0 / 全 ${school.playerIds.length}人`),
    ).toBeVisible();
  });

  it("sorts the visible roster by real four-week growth", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const growingId = school.playerIds.at(-1)!;
    const zeroId = school.playerIds.at(-2)!;
    state.history.playerDevelopmentWeeks = [
      {
        gameDate: "2026-04-01",
        academicYearIndex: state.yearIndex,
        weekOfYear: 1,
        trainingMenuId: "training.balanced",
        players: [
          { playerId: growingId, totalAbilityGrowth: 8, abilityChanges: {} },
          { playerId: zeroId, totalAbilityGrowth: 0, abilityChanges: {} },
        ],
      },
    ];
    renderPlayerHub(state);

    fireEvent.change(screen.getByLabelText("並び替え"), {
      target: { value: "growth-4w" },
    });

    const rows = screen.getAllByTestId("roster-player-row");
    expect(
      within(rows[0]!).getByText(
        `${state.players[growingId]!.lastName} ${state.players[growingId]!.firstName}`,
      ),
    ).toBeVisible();
    expect(within(rows[0]!).getByText("4週 +8")).toBeVisible();
  });

  it("adds and removes explicit development priorities while enforcing the three-player UI cap", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const firstThree = school.playerIds.slice(0, 3);
    const fourthId = school.playerIds[3]!;
    const fourth = state.players[fourthId]!;
    state.teamPlanning.developmentPriorityPlayerIds = [...firstThree];
    const onSetDevelopmentPriorities = vi.fn();
    const { view } = renderPlayerHub(state, vi.fn(), {
      onSetDevelopmentPriorities,
    });

    const fourthAdd = screen.getByRole("button", {
      name: `重点育成に追加 ${fourth.lastName} ${fourth.firstName}`,
    });
    expect(fourthAdd).toBeDisabled();

    const first = state.players[firstThree[0]!]!;
    fireEvent.click(
      screen.getByRole("button", {
        name: `重点育成から外す ${first.lastName} ${first.firstName}`,
      }),
    );
    expect(onSetDevelopmentPriorities).toHaveBeenLastCalledWith(
      firstThree.slice(1),
    );

    view.rerender(
      <PlayerHubScreen
        onAssignLeadership={vi.fn()}
        onChange={vi.fn()}
        onSetDevelopmentPriorities={onSetDevelopmentPriorities}
        selection={autoSelectTeam({ state, schoolId: state.userSchoolId })}
        state={{
          ...state,
          teamPlanning: {
            ...state.teamPlanning,
            developmentPriorityPlayerIds: firstThree.slice(1),
          },
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: `重点育成に追加 ${fourth.lastName} ${fourth.firstName}`,
      }),
    );
    expect(onSetDevelopmentPriorities).toHaveBeenLastCalledWith([
      ...firstThree.slice(1),
      fourthId,
    ]);
  });

  it("disables every priority mutation while planning is pending", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    state.teamPlanning.developmentPriorityPlayerIds = [school.playerIds[0]!];
    renderPlayerHub(state, vi.fn(), { planningPending: true });

    const priorityButtons = screen.getAllByRole("button", {
      name: /重点育成(に追加|から外す)/,
    });
    expect(priorityButtons.length).toBeGreaterThan(0);
    expect(
      priorityButtons.every((button) => button.hasAttribute("disabled")),
    ).toBe(true);
  });

  it("opens a compact player detail with growth type, talent and potential", () => {
    const { state, view } = renderPlayerHub();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;
    const development = getPlayerDevelopmentPresentation(player);

    expect(screen.getByRole("heading", { name: "選手一覧" })).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: `選手詳細 ${player.lastName} ${player.firstName}`,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: `${player.lastName} ${player.firstName}`,
      }),
    ).toBeVisible();
    expect(screen.getByText("総合力")).toBeVisible();
    expect(
      screen.getByText(
        `${player.grade}年・${player.preferredPosition}・${player.heightCm}cm`,
      ),
    ).toBeVisible();
    const developmentRegion = screen.getByRole("region", {
      name: "成長タイプと才能",
    });
    expect(within(developmentRegion).getByText("成長タイプ")).toBeVisible();
    expect(
      within(developmentRegion).getByText(development.growthLabel),
    ).toBeVisible();
    expect(within(developmentRegion).getByText("才能")).toBeVisible();
    expect(
      within(developmentRegion).getByText(development.talentLabel),
    ).toBeVisible();
    if (development.potential !== null) {
      expect(
        within(developmentRegion).getByText(
          `将来性 ${development.potentialGrade}・${development.potential}`,
        ),
      ).toBeVisible();
    }
    expect(screen.queryByText(player.reading)).toBeNull();
    expect(view.container.querySelector(".player-detail__hero")).toBeNull();
    expect(
      view.container.querySelector(".player-detail__summary"),
    ).not.toBeNull();

    const growthRegion = screen.getByRole("region", { name: "最近の成長" });
    expect(within(growthRegion).getByText("4週 --")).toBeVisible();
    expect(within(growthRegion).getByText("12週 --")).toBeVisible();
    expect(
      within(growthRegion).getByText("成長履歴はまだありません"),
    ).toBeVisible();
    expect(
      within(growthRegion).queryAllByTestId("player-growth-trend-bar"),
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "選手一覧へ戻る" }));
    expect(screen.getByRole("heading", { name: "選手一覧" })).toBeVisible();
  });

  it("shows only real player growth logs in the detail trend", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const player = state.players[playerId]!;
    state.history.playerDevelopmentWeeks = [
      {
        gameDate: "2026-04-01",
        academicYearIndex: state.yearIndex,
        weekOfYear: 1,
        trainingMenuId: "training.balanced",
        players: [{ playerId, totalAbilityGrowth: 0, abilityChanges: {} }],
      },
      {
        gameDate: "2026-04-08",
        academicYearIndex: state.yearIndex,
        weekOfYear: 2,
        trainingMenuId: "training.balanced",
        players: [],
      },
      {
        gameDate: "2026-04-15",
        academicYearIndex: state.yearIndex,
        weekOfYear: 3,
        trainingMenuId: "training.balanced",
        players: [
          { playerId, totalAbilityGrowth: 5, abilityChanges: { spike: 5 } },
        ],
      },
    ];
    renderPlayerHub(state);

    fireEvent.click(
      screen.getByRole("button", {
        name: `選手詳細 ${player.lastName} ${player.firstName}`,
      }),
    );

    const growthRegion = screen.getByRole("region", { name: "最近の成長" });
    expect(within(growthRegion).getByText("4週 +5")).toBeVisible();
    expect(within(growthRegion).getByText("12週 +5")).toBeVisible();
    expect(within(growthRegion).getByText("2週記録")).toBeVisible();
    const bars = within(growthRegion).getAllByTestId("player-growth-trend-bar");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute("data-growth", "0");
    expect(bars[1]).toHaveAttribute("data-growth", "5");
  });

  it("keeps the existing lineup editor available", () => {
    renderPlayerHub();

    fireEvent.click(screen.getByRole("button", { name: "編成" }));
    expect(screen.getByRole("heading", { name: "チーム編成" })).toBeVisible();
  });

  it("opens team dynamics management and submits leadership ids", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const captainPlayerId = school.playerIds[0]!;
    const viceCaptainPlayerId = school.playerIds[1]!;
    const onAssignLeadership = vi.fn();
    renderPlayerHub(state, onAssignLeadership);

    fireEvent.click(screen.getByRole("button", { name: "チーム状態" }));
    expect(screen.getByRole("heading", { name: "チーム状態" })).toBeVisible();

    fireEvent.change(screen.getByLabelText("主将"), {
      target: { value: captainPlayerId },
    });
    fireEvent.change(screen.getByLabelText("副主将"), {
      target: { value: viceCaptainPlayerId },
    });
    fireEvent.click(screen.getByRole("button", { name: "役職を保存" }));

    expect(onAssignLeadership).toHaveBeenCalledWith(
      captainPlayerId,
      viceCaptainPlayerId,
    );
  });

  it("shows the player's role, trust, morale, and current concern", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const player = state.players[playerId]!;
    state.teamDynamics = {
      ...state.teamDynamics,
      playerRoles: { [playerId]: "ace" },
      playerConcerns: {
        [playerId]: [{ code: "playing-time", severity: 2 }],
      },
    };
    renderPlayerHub(state);

    fireEvent.click(
      screen.getByRole("button", {
        name: `選手詳細 ${player.lastName} ${player.firstName}`,
      }),
    );

    expect(screen.getByText("エース")).toBeVisible();
    expect(screen.getByText("信頼")).toBeVisible();
    expect(screen.getByText(String(player.trust))).toBeVisible();
    expect(screen.getByText(/出場機会/)).toBeVisible();
  });
});
