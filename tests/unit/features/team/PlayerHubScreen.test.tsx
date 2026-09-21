import { fireEvent, render, screen, within } from "@testing-library/react";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { getPlayerConditionPresentation } from "../../../../src/domain/player/playerCondition";
import { getPlayerDevelopmentPresentation } from "../../../../src/domain/player/playerDevelopmentPresentation";
import {
  calculatePlayerDisplayPower,
  summarizePlayerAbilities,
} from "../../../../src/domain/selectors/playerPresentation";
import { ratingToGrade } from "../../../../src/domain/selectors/ratingGrades";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PlayerHubScreen } from "../../../../src/features/team/PlayerHubScreen";

interface RenderOptions {
  onSaveTrainingAssignments?: (
    assignments: Array<{ playerId: string; instructionId: string }>,
  ) => void;
  onSetDevelopmentPriorities?: (playerIds: string[]) => void;
  onSetPlayerDevelopmentGoal?: (
    playerId: string,
    goal: {
      area: "attack" | "defense" | "jump" | "stamina" | "mental";
      targetGrade: "A" | "B" | "C" | "D" | "E" | "F" | "G";
    } | null,
  ) => void;
  planningPending?: boolean;
  trainingPending?: boolean;
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
      data={gameData}
      onAssignLeadership={onAssignLeadership}
      onChange={vi.fn()}
      onSaveTrainingAssignments={options.onSaveTrainingAssignments}
      onSetDevelopmentPriorities={onSetDevelopmentPriorities}
      onSetPlayerDevelopmentGoal={options.onSetPlayerDevelopmentGoal}
      planningPending={options.planningPending}
      selection={selection}
      state={state}
      trainingPending={options.trainingPending}
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
  it("renders a compact portrait-free mobile roster with only decision-critical row data", () => {
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
        `${player.grade}年・${player.preferredPosition}`,
      ),
    ).toBeVisible();
    expect(
      within(firstRow).queryByText(new RegExp(`${player.heightCm}cm`)),
    ).toBeNull();
    expect(within(firstRow).getByText("総合")).toBeVisible();
    expect(
      within(firstRow).getByText(
        String(Math.round(calculatePlayerDisplayPower(player) / 100)),
      ),
    ).toBeVisible();
    expect(within(firstRow).getByTitle(condition.label)).toBeVisible();
    expect(within(firstRow).getByText(condition.label)).toBeVisible();
    expect(within(firstRow).queryByText(/4週/)).toBeNull();

    const abilities = summarizePlayerAbilities(player);
    const abilityRanks = within(firstRow).getByLabelText(
      `${player.lastName} ${player.firstName} 能力ランク`,
    );
    for (const [key, label] of [
      ["attack", "攻撃"],
      ["defense", "守備"],
      ["jump", "跳躍"],
      ["stamina", "スタミナ"],
      ["mental", "メンタル"],
    ] as const) {
      expect(
        within(abilityRanks).getByLabelText(
          `${label} ${ratingToGrade(abilities[key])}`,
        ),
      ).toBeVisible();
    }
  });

  it("stages multiple training changes and saves them together once", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const firstId = school.playerIds[0]!;
    const secondId = school.playerIds[1]!;
    const first = state.players[firstId]!;
    const second = state.players[secondId]!;
    const onSaveTrainingAssignments = vi.fn();
    const onSetDevelopmentPriorities = vi.fn();
    state.teamDynamics.captainPlayerId = firstId;
    state.teamPlanning.developmentPriorityPlayerIds = [firstId];
    first.injury = {
      injuryId: "injury.phase24-1",
      severity: "minor",
      remainingWeeks: 1,
      recurrenceRisk: 0,
    };
    renderPlayerHub(state, vi.fn(), {
      onSaveTrainingAssignments,
      onSetDevelopmentPriorities,
    });

    const firstDetailButton = screen.getByRole("button", {
      name: `選手詳細 ${first.lastName} ${first.firstName}`,
    });
    const firstRow = firstDetailButton.closest(
      '[data-testid="roster-player-row"]',
    ) as HTMLElement;
    expect(within(firstRow).getByText("主将")).toBeVisible();
    expect(within(firstRow).getByText("怪我")).toBeVisible();
    expect(within(firstRow).getByText("重点")).toBeVisible();

    fireEvent.click(
      within(firstRow).getByRole("button", {
        name: `重点育成から外す ${first.lastName} ${first.firstName}`,
      }),
    );
    expect(onSetDevelopmentPriorities).toHaveBeenCalledWith([]);

    fireEvent.click(
      within(firstRow).getByRole("button", {
        name: `${first.lastName} ${first.firstName} 個人練習 全体`,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^攻撃/ }));

    const secondDetailButton = screen.getByRole("button", {
      name: `選手詳細 ${second.lastName} ${second.firstName}`,
    });
    const secondRow = secondDetailButton.closest(
      '[data-testid="roster-player-row"]',
    ) as HTMLElement;
    fireEvent.click(
      within(secondRow).getByRole("button", {
        name: `${second.lastName} ${second.firstName} 個人練習 全体`,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^守備/ }));

    expect(onSaveTrainingAssignments).not.toHaveBeenCalled();
    expect(within(firstRow).getByText("未保存")).toBeVisible();
    expect(within(secondRow).getByText("未保存")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "まとめて保存（2人）" }),
    );

    expect(onSaveTrainingAssignments).toHaveBeenCalledTimes(1);
    expect(onSaveTrainingAssignments).toHaveBeenCalledWith(
      expect.arrayContaining([
        { playerId: firstId, instructionId: "instruction.attack" },
        { playerId: secondId, instructionId: "instruction.defense" },
      ]),
    );
  });

  it("filters the roster and exposes all required sort options", () => {
    const { state } = renderPlayerHub();
    const school = state.schools[state.userSchoolId]!;
    const expectedGradeOne = school.playerIds.filter(
      (id) => state.players[id]!.grade === 1,
    ).length;

    fireEvent.click(screen.getByLabelText("選手絞り込み"));
    const filterDialog = screen.getByRole("dialog", { name: "表示する選手" });
    for (const label of [
      "全員",
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
      expect(
        within(filterDialog).getByRole("button", { name: label }),
      ).toBeVisible();
    }
    fireEvent.click(within(filterDialog).getByRole("button", { name: "1年" }));

    fireEvent.click(screen.getByLabelText("並び替え"));
    const sortDialog = screen.getByRole("dialog", { name: "並び順" });
    for (const label of [
      "総合力順",
      "将来性順",
      "調子順",
      "直近4週の成長順",
      "学年順",
    ]) {
      expect(
        within(sortDialog).getByRole("button", { name: label }),
      ).toBeVisible();
    }
    fireEvent.click(
      within(sortDialog).getByRole("button", { name: "総合力順" }),
    );
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

    fireEvent.click(screen.getByLabelText("選手絞り込み"));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "表示する選手" })).getByRole(
        "button",
        { name: "怪我中" },
      ),
    );

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

    fireEvent.click(screen.getByLabelText("並び替え"));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "並び順" })).getByRole(
        "button",
        { name: "直近4週の成長順" },
      ),
    );

    const rows = screen.getAllByTestId("roster-player-row");
    expect(
      within(rows[0]!).getByText(
        `${state.players[growingId]!.lastName} ${state.players[growingId]!.firstName}`,
      ),
    ).toBeVisible();
    expect(within(rows[0]!).queryByText(/4週/)).toBeNull();
  });

  it("manages development priorities directly from the roster", () => {
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
    expect(fourthAdd).toHaveAttribute("title", "重点育成は3名まで");

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
        data={gameData}
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

  it("disables every roster priority mutation while planning is pending", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    state.teamPlanning.developmentPriorityPlayerIds = [school.playerIds[0]!];
    renderPlayerHub(state, vi.fn(), { planningPending: true });

    const first = state.players[school.playerIds[0]!]!;
    expect(
      screen.getByRole("button", {
        name: `重点育成から外す ${first.lastName} ${first.firstName}`,
      }),
    ).toBeDisabled();
  });

  it("splits player detail into ability, growth, and personality views", () => {
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
    expect(screen.getByRole("button", { name: "能力" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("region", { name: "選手能力" })).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "成長タイプと才能" }),
    ).toBeNull();
    expect(screen.queryByRole("region", { name: "性格" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "成長" }));
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

    const growthRegion = screen.getByRole("region", { name: "最近の成長" });
    expect(within(growthRegion).getByText("4週 --")).toBeVisible();
    expect(within(growthRegion).getByText("12週 --")).toBeVisible();
    expect(
      within(growthRegion).getByText("成長履歴はまだありません"),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "人物" }));
    expect(screen.getByRole("region", { name: "性格" })).toBeVisible();
    expect(screen.getByRole("region", { name: "人間関係" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "選手能力" })).toBeNull();

    expect(screen.queryByText(player.reading)).toBeNull();
    expect(view.container.querySelector(".player-detail__hero")).toBeNull();
    expect(
      view.container.querySelector(".player-detail__summary"),
    ).not.toBeNull();

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

    fireEvent.click(screen.getByRole("button", { name: "成長" }));

    const growthRegion = screen.getByRole("region", { name: "最近の成長" });
    expect(within(growthRegion).getByText("4週 +5")).toBeVisible();
    expect(within(growthRegion).getByText("12週 +5")).toBeVisible();
    expect(within(growthRegion).getByText("2週記録")).toBeVisible();
    const bars = within(growthRegion).getAllByTestId("player-growth-trend-bar");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute("data-growth", "0");
    expect(bars[1]).toHaveAttribute("data-growth", "5");
  });

  it("shows only revealed hidden character traits in player detail", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const player = state.players[playerId]!;
    player.hiddenTraitIds = ["character.caring"];
    player.revealedHiddenTraitIds = [];
    player.hiddenTraitAssignmentInitialized = true;
    const { view, selection } = renderPlayerHub(state);

    fireEvent.click(
      screen.getByRole("button", {
        name: `選手詳細 ${player.lastName} ${player.firstName}`,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "人物" }));

    expect(screen.queryByRole("region", { name: "発見した個性" })).toBeNull();
    expect(screen.queryByText("面倒見がいい")).toBeNull();

    player.revealedHiddenTraitIds = ["character.caring", "character.missing"];
    view.rerender(
      <PlayerHubScreen
        data={gameData}
        onAssignLeadership={vi.fn()}
        onChange={vi.fn()}
        selection={selection}
        state={state}
      />,
    );

    const region = screen.getByRole("region", { name: "発見した個性" });
    expect(within(region).getByText("面倒見がいい")).toBeVisible();
    expect(
      within(region).getByText(
        "後輩や仲間の様子に気づき、自然に支えようとする。",
      ),
    ).toBeVisible();
    expect(within(region).queryByText("character.missing")).toBeNull();
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

    fireEvent.click(screen.getByRole("button", { name: "チーム" }));
    expect(screen.getByRole("heading", { name: "チーム状態" })).toBeVisible();

    fireEvent.click(screen.getByLabelText("主将"));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "主将を選ぶ" })).getByRole(
        "button",
        {
          name: `${state.players[captainPlayerId]!.lastName} ${state.players[captainPlayerId]!.firstName}`,
        },
      ),
    );
    fireEvent.click(screen.getByLabelText("副主将"));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "副主将を選ぶ" })).getByRole(
        "button",
        {
          name: `${state.players[viceCaptainPlayerId]!.lastName} ${state.players[viceCaptainPlayerId]!.firstName}`,
        },
      ),
    );
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
    expect(screen.queryByText(/出場機会/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "人物" }));
    expect(screen.getByText(/出場機会/)).toBeVisible();
  });

  it("sets and clears a next-rank development goal from the growth tab", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const onSetPlayerDevelopmentGoal = vi.fn();

    const { view } = renderPlayerHub(state, vi.fn(), {
      onSetPlayerDevelopmentGoal,
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: `選手詳細 ${player.lastName} ${player.firstName}`,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "成長" }));

    const goalRegion = screen.getByRole("region", { name: "育成目標" });
    expect(within(goalRegion).getByText("未設定")).toBeVisible();

    const availableGoal = within(goalRegion)
      .getAllByRole("button")
      .find((button) => !button.hasAttribute("disabled"));
    expect(availableGoal).toBeDefined();
    fireEvent.click(availableGoal!);

    expect(onSetPlayerDevelopmentGoal).toHaveBeenCalledTimes(1);
    expect(onSetPlayerDevelopmentGoal).toHaveBeenCalledWith(
      playerId,
      expect.objectContaining({
        area: expect.stringMatching(/^(attack|defense|jump|stamina|mental)$/),
        targetGrade: expect.stringMatching(/^[A-G]$/),
      }),
    );

    const savedGoal = onSetPlayerDevelopmentGoal.mock.calls[0]![1];
    view.rerender(
      <PlayerHubScreen
        data={gameData}
        onAssignLeadership={vi.fn()}
        onChange={vi.fn()}
        onSetPlayerDevelopmentGoal={onSetPlayerDevelopmentGoal}
        selection={autoSelectTeam({ state, schoolId: state.userSchoolId })}
        state={{
          ...state,
          teamPlanning: {
            ...state.teamPlanning,
            developmentGoalsByPlayerId: {
              [playerId]: savedGoal,
            },
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "目標を解除" }));
    expect(onSetPlayerDevelopmentGoal).toHaveBeenLastCalledWith(playerId, null);
  });
  it("reviews coach proposals, preserves manual drafts, and stages the rest for one batch save", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const manualId = school.playerIds[0]!;
    const restId = school.playerIds[1]!;
    const manualPlayer = state.players[manualId]!;
    const restPlayer = state.players[restId]!;
    const onSaveTrainingAssignments = vi.fn();

    state.teamPlanning.developmentGoalsByPlayerId = {
      [manualId]: { area: "defense", targetGrade: "A" },
    };
    restPlayer.injury = {
      injuryId: "injury.phase26-4-ui",
      severity: "minor",
      remainingWeeks: 1,
      recurrenceRisk: 0,
    };

    renderPlayerHub(state, vi.fn(), { onSaveTrainingAssignments });

    fireEvent.click(
      screen.getByRole("button", {
        name: `${manualPlayer.lastName} ${manualPlayer.firstName} 個人練習 全体`,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^攻撃/ }));

    fireEvent.click(
      screen.getByRole("button", { name: "コーチの個人練習提案" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "コーチの個人練習提案",
    });
    expect(within(dialog).getByText(/監督育成力/)).toBeVisible();
    expect(
      within(dialog).getByText(
        `${manualPlayer.lastName} ${manualPlayer.firstName}`,
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByText(`${restPlayer.lastName} ${restPlayer.firstName}`),
    ).toBeVisible();
    expect(within(dialog).getByText(/怪我中のため回復を優先/)).toBeVisible();

    fireEvent.click(
      within(dialog).getByRole("button", { name: /提案をセット/ }),
    );

    expect(onSaveTrainingAssignments).not.toHaveBeenCalled();
    const saveButton = screen.getByRole("button", {
      name: /まとめて保存（\d+人）/,
    });
    fireEvent.click(saveButton);

    expect(onSaveTrainingAssignments).toHaveBeenCalledTimes(1);
    expect(onSaveTrainingAssignments).toHaveBeenCalledWith(
      expect.arrayContaining([
        { playerId: manualId, instructionId: "instruction.attack" },
        { playerId: restId, instructionId: "instruction.rest" },
      ]),
    );
  });

});
