import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  matchId,
  type GameDate,
} from "../../../../src/domain/model/identifiers";
import { buildSeasonProgressPresentation } from "../../../../src/features/season/seasonProgressPresentation";
import { SchoolScreen } from "../../../../src/features/school/SchoolScreen";

function createState() {
  return createDemoGame();
}

describe("school management screen", () => {
  it("shows school status with Japanese headings and confirms a facility upgrade", () => {
    const state = createState();
    const onUpgradeFacility = vi.fn();

    render(
      <SchoolScreen onUpgradeFacility={onUpgradeFacility} state={state} />,
    );

    expect(screen.getByRole("heading", { name: "学校" })).toBeVisible();
    expect(screen.getAllByText("学校運営").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: "運営" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "設備" })).toBeVisible();
    expect(screen.queryByText("SCHOOL MANAGEMENT")).toBeNull();
    expect(screen.queryByText("FACILITIES")).toBeNull();
    expect(screen.getByText("無名校")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "資金 750・履歴を表示" }),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "トレーニング設備の詳細" }),
    );

    const dialog = screen.getByRole("dialog", { name: "設備を強化" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByText("Lv.0 → Lv.1")).toBeVisible();
    expect(within(dialog).getByText("強化後の資金")).toBeVisible();
    expect(within(dialog).getByText("680")).toBeVisible();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "+1 Lv・70を使って強化" }),
    );
    expect(onUpgradeFacility).toHaveBeenCalledWith("trainingRoom", 1);
  });

  it("shows all facilities in a compact command grid without repeated management headings", () => {
    const state = createState();

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);

    const management = screen.getByRole("region", { name: "学校運営" });
    expect(within(management).getByText("強化可能 8/8")).toBeVisible();
    expect(within(management).getByText("資金 750")).toBeVisible();
    expect(within(management).getAllByTestId("facility-tile")).toHaveLength(8);
    expect(within(management).getByText("トレーニング")).toBeVisible();
    expect(within(management).getByText("回復")).toBeVisible();
    expect(within(management).getByText("学習")).toBeVisible();
    expect(within(management).queryByText("育成拠点")).toBeNull();
    expect(
      within(management).queryByText("学校の育成環境を強化"),
    ).toBeNull();
    expect(within(management).queryByText("最大 Lv.50")).toBeNull();

    fireEvent.click(
      within(management).getByRole("button", {
        name: "トレーニング設備の詳細",
      }),
    );
    expect(
      within(screen.getByRole("dialog", { name: "設備を強化" })).getByText(
        "週間練習で得られる能力成長を高めます。",
      ),
    ).toBeVisible();
  });

  it("switches School management between facilities and coaches", () => {
    const state = createState();

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);

    const managementTabs = screen.getByRole("tablist", {
      name: "運営メニュー",
    });
    expect(
      within(managementTabs).getByRole("tab", { name: "設備" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "設備" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "スタッフ" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(managementTabs).getByRole("tab", { name: "コーチ" }),
    );
    expect(
      within(managementTabs).getByRole("tab", { name: "コーチ" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "スタッフ" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "設備" }),
    ).not.toBeInTheDocument();
  });

  it("lets the player choose +5 or +10 bulk facility upgrades", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    state.schools[state.userSchoolId] = { ...school, funds: 5000 };
    const onUpgradeFacility = vi.fn();

    render(
      <SchoolScreen onUpgradeFacility={onUpgradeFacility} state={state} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "トレーニング設備の詳細" }),
    );
    const dialog = screen.getByRole("dialog", { name: "設備を強化" });

    fireEvent.click(within(dialog).getByRole("button", { name: /\+5 Lv/ }));
    expect(within(dialog).getByText("Lv.0 → Lv.5")).toBeVisible();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "+5 Lv・381を使って強化" }),
    );
    expect(onUpgradeFacility).toHaveBeenCalledWith("trainingRoom", 5);
  });

  it("opens the funds ledger and renders persisted history newest first", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    state.schools[state.userSchoolId] = { ...school, funds: 700 };
    state.schoolManagement = {
      ...state.schoolManagement,
      fundsHistory: [
        {
          id: "initial-funds:year-1",
          gameDate: "2026-04-01" as GameDate,
          academicYearIndex: 1,
          kind: "initial-funds",
          amount: 300,
          balanceAfter: 300,
          label: "初期活動資金",
        },
        {
          id: "annual-budget:year-1",
          gameDate: "2026-04-01" as GameDate,
          academicYearIndex: 1,
          kind: "annual-budget",
          amount: 400,
          balanceAfter: 700,
          label: "初年度学校予算",
        },
      ],
    };

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);

    fireEvent.click(screen.getByRole("button", { name: /資金 700/ }));
    const dialog = screen.getByRole("dialog", { name: "資金履歴" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByText("初年度学校予算")).toBeVisible();
    expect(within(dialog).getByText("+400")).toBeVisible();
    expect(within(dialog).getByText("初期活動資金")).toBeVisible();
    expect(within(dialog).getByText("+300")).toBeVisible();

    const entries = within(dialog).getAllByTestId("funds-ledger-entry");
    expect(entries[0]).toHaveTextContent("初年度学校予算");
    expect(entries[1]).toHaveTextContent("初期活動資金");
  });

  it("disables upgrades when funds are insufficient or the facility is maxed", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    state.schools[state.userSchoolId] = {
      ...school,
      funds: 10,
      facilities: {
        ...school.facilities,
        gym: 50,
      },
    };

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);

    expect(screen.getByText("あと60必要")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "体育館の詳細" }));
    let dialog = screen.getByRole("dialog", { name: "設備を強化" });
    expect(
      within(dialog).getByRole("button", { name: "体育館は最大レベル" }),
    ).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));

    fireEvent.click(
      screen.getByRole("button", { name: "トレーニング設備の詳細" }),
    );
    dialog = screen.getByRole("dialog", { name: "設備を強化" });
    expect(
      within(dialog).getByRole("button", {
        name: "トレーニング設備は資金不足",
      }),
    ).toBeDisabled();
  });

  it("keeps the school summary compact and focused on management status", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    const presentation = buildSeasonProgressPresentation(state)!;

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);

    const summary = screen.getByRole("region", { name: "学校サマリー" });
    expect(
      within(summary).getByRole("article", { name: "評判" }),
    ).toHaveTextContent(String(school.reputationPoints));
    expect(
      within(summary).getByRole("article", { name: "県内順位" }),
    ).toHaveTextContent(`${presentation.regional.rank}位`);
    expect(
      within(summary).getByRole("article", { name: "全国順位" }),
    ).toHaveTextContent(`${presentation.national.rank}位`);
    expect(screen.queryByText("監督")).toBeNull();
    expect(screen.queryByText("宿命校")).toBeNull();
    expect(screen.queryByText("通算シーズン")).toBeNull();
  });

  it("shows the five most recent school matches in date order with Japanese labels", () => {
    const state = createState();
    const rivals = Object.values(state.schools).filter(
      (school) => school.id !== state.userSchoolId,
    );
    state.history.matches = Array.from({ length: 6 }, (_, index) => ({
      matchId: matchId(`school-record-${index}`),
      date: `2026-04-${String(index + 1).padStart(2, "0")}` as GameDate,
      homeSchoolId: state.userSchoolId,
      awaySchoolId: rivals[index]!.id,
      winnerSchoolId: index % 2 === 0 ? state.userSchoolId : rivals[index]!.id,
      homeSetsWon: index % 2 === 0 ? 2 : 1,
      awaySetsWon: index % 2 === 0 ? 0 : 2,
      tournamentId: null,
    }));

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);
    fireEvent.click(screen.getByRole("tab", { name: "記録" }));
    fireEvent.click(screen.getByRole("tab", { name: "戦績" }));

    expect(screen.getByTestId("school-record-results")).toBeVisible();
    expect(screen.queryByText("SCHOOL RECORDS")).toBeNull();
    const rows = screen.getAllByTestId("school-match-record");
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent("2026年4月6日");
    expect(rows[0]).toHaveTextContent(rivals[5]!.name);
    expect(screen.queryByText(rivals[0]!.name)).not.toBeInTheDocument();
  });

  it("shows current season goals and regional/national ranking progression in records", () => {
    const state = createState();
    const presentation = buildSeasonProgressPresentation(state)!;

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);
    fireEvent.click(screen.getByRole("tab", { name: "記録" }));

    const dashboard = screen.getByRole("region", { name: "今季ランキング" });
    expect(dashboard).toBeVisible();
    for (const goal of presentation.goals) {
      expect(within(dashboard).getByText(goal.label)).toBeVisible();
      expect(within(dashboard).getByText(goal.progressLabel)).toBeVisible();
    }

    const regional = within(dashboard).getByRole("region", {
      name: "県内ランキング",
    });
    expect(regional).toHaveTextContent(
      `${presentation.regional.rank}位 / ${presentation.regional.total}校`,
    );
    expect(regional).toHaveTextContent(
      `開始時 ${presentation.regional.startingRank}位`,
    );

    const national = within(dashboard).getByRole("region", {
      name: "全国ランキング",
    });
    expect(national).toHaveTextContent(
      `${presentation.national.rank}位 / ${presentation.national.total}校`,
    );
    expect(national).toHaveTextContent(
      `開始時 ${presentation.national.startingRank}位`,
    );

    const userRows = within(dashboard).getAllByTestId(
      "school-ranking-user-row",
    );
    expect(userRows).toHaveLength(2);
    expect(userRows[0]).toHaveTextContent(
      state.schools[state.userSchoolId]!.shortName,
    );
    expect(userRows[1]).toHaveTextContent(
      state.schools[state.userSchoolId]!.shortName,
    );
  });

  it("shows graduate history inside records", () => {
    const state = createState();
    const player =
      state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;

    const { rerender } = render(
      <SchoolScreen onUpgradeFacility={vi.fn()} state={state} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "記録" }));
    fireEvent.click(screen.getByRole("tab", { name: "歴史" }));
    expect(screen.getByRole("heading", { name: "卒業生記録" })).toBeVisible();
    expect(screen.queryByText("ALUMNI")).toBeNull();
    expect(screen.getByText("卒業生の記録はまだありません")).toBeVisible();

    const withGraduate = {
      ...state,
      history: {
        ...state.history,
        graduates: [
          {
            playerId: player.id,
            schoolId: state.userSchoolId,
            graduationYear: 2026,
            displayName: `${player.lastName} ${player.firstName}`,
            position: player.preferredPosition,
            appearances: 18,
            points: 210,
            blocks: 35,
            serviceAces: 22,
            awardIds: [],
          },
        ],
      },
    };

    rerender(<SchoolScreen onUpgradeFacility={vi.fn()} state={withGraduate} />);
    expect(
      screen.getByText(`${player.lastName} ${player.firstName}`),
    ).toBeVisible();
    expect(screen.getByText("出場 18")).toBeVisible();
    expect(screen.getByText("得点 210")).toBeVisible();
  });
});
