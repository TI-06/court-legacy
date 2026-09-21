import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { playerId } from "../../../../src/domain/model/identifiers";
import type { ScoutReport } from "../../../../src/domain/scouting/scoutReport";
import { SchoolScreen } from "../../../../src/features/school/SchoolScreen";
import { ScoutingScreen } from "../../../../src/features/scouting/ScoutingScreen";

const candidateA = playerId("candidate-a");
const candidateB = playerId("candidate-b");

const reports: ScoutReport[] = [
  {
    candidateId: candidateA,
    displayName: "青木 蓮",
    heightCm: 188,
    position: "OH",
    handedness: "right",
    middleSchoolAchievement: "prefectural-selection",
    evaluationStars: 4,
    estimatedOverall: { min: 58, max: 72 },
    estimatedPotential: { min: 72, max: 89 },
    estimatedAbilities: {
      attack: { min: 61, max: 71 },
      defense: { min: 50, max: 62 },
      jump: { min: 64, max: 74 },
      stamina: { min: 55, max: 67 },
      mental: { min: 52, max: 64 },
    },
    confidence: "medium",
    comments: ["攻撃力に目を引くものがある", "高さは武器になりそう"],
  },
  {
    candidateId: candidateB,
    displayName: "佐藤 湊",
    heightCm: 181,
    position: "S",
    handedness: "left",
    middleSchoolAchievement: "national-event",
    evaluationStars: 5,
    estimatedOverall: { min: 68, max: 80 },
    estimatedPotential: { min: 82, max: 96 },
    estimatedAbilities: {
      attack: { min: 69, max: 77 },
      defense: { min: 63, max: 71 },
      jump: { min: 60, max: 68 },
      stamina: { min: 66, max: 74 },
      mental: { min: 74, max: 82 },
    },
    confidence: "high",
    comments: ["トスワークの感覚が良い", "大舞台の経験がある"],
  },
];

function stateWithCommitted(candidateIds: (typeof candidateA)[] = []) {
  const state = createDemoGame();
  state.recruiting = {
    cycleKey: `${state.userSchoolId}:year-${state.yearIndex}`,
    committedCandidateIds: candidateIds,
  };
  return state;
}

describe("ScoutingScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders only the public scouting report fields with Japanese labels", () => {
    render(
      <ScoutingScreen
        error={null}
        loading={false}
        onBack={vi.fn()}
        onRecruit={vi.fn()}
        onRetry={vi.fn()}
        recruitingCandidateId={null}
        reports={reports}
        state={stateWithCommitted([candidateB])}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "新入生スカウト" }),
    ).toBeVisible();
    expect(screen.getAllByText("新入生スカウト").length).toBeGreaterThan(0);
    expect(screen.queryByText("RECRUITING")).toBeNull();
    expect(screen.getByText("青木 蓮")).toBeVisible();
    expect(screen.getByText(/OH/)).toBeVisible();
    expect(screen.getByText(/188cm/)).toBeVisible();
    expect(screen.getByText(/県選抜/)).toBeVisible();
    expect(screen.getByText(/★★★★☆/)).toBeVisible();
    expect(screen.getByText("58〜72")).toBeVisible();
    expect(screen.getByText("72〜89")).toBeVisible();
    expect(screen.getByText(/調査精度 中/)).toBeVisible();
    const abilityEstimate = screen.getByLabelText("青木 蓮 推定能力");
    expect(
      within(abilityEstimate).getByLabelText("攻 推定 61〜71"),
    ).toBeVisible();
    expect(
      within(abilityEstimate).getByLabelText("守 推定 50〜62"),
    ).toBeVisible();
    expect(
      within(abilityEstimate).getByLabelText("跳 推定 64〜74"),
    ).toBeVisible();
    expect(
      within(abilityEstimate).getByLabelText("体 推定 55〜67"),
    ).toBeVisible();
    expect(
      within(abilityEstimate).getByLabelText("心 推定 52〜64"),
    ).toBeVisible();
    expect(screen.getByText("攻撃力に目を引くものがある")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "獲得候補にする 青木 蓮" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "獲得済み 佐藤 湊" }),
    ).toBeDisabled();
    expect(screen.queryByText(/monster|generational|potential 96/)).toBeNull();
  });

  it("keeps the school tabs visible and returns directly to the selected school view", () => {
    const state = stateWithCommitted();
    const onBack = vi.fn();
    const scouting = render(
      <ScoutingScreen
        error={null}
        loading={false}
        onBack={onBack}
        onRecruit={vi.fn()}
        onRetry={vi.fn()}
        recruitingCandidateId={null}
        reports={reports}
        state={state}
      />,
    );

    expect(screen.getByRole("tab", { name: "スカウト" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("tab", { name: "記録" }));
    expect(onBack).toHaveBeenCalledOnce();

    scouting.unmount();
    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);
    expect(screen.getByRole("tab", { name: "記録" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("heading", { name: "学校記録" })).toBeVisible();
  });

  it("shows explicit loading and recruiting progress without blanking the screen", () => {
    const state = stateWithCommitted();
    const { rerender } = render(
      <ScoutingScreen
        error={null}
        loading
        onBack={vi.fn()}
        onRecruit={vi.fn()}
        onRetry={vi.fn()}
        recruitingCandidateId={null}
        reports={[]}
        state={state}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "候補を調査しています…",
    );
    expect(
      screen.getByRole("heading", { name: "新入生スカウト" }),
    ).toBeVisible();

    rerender(
      <ScoutingScreen
        error={null}
        loading={false}
        onBack={vi.fn()}
        onRecruit={vi.fn()}
        onRetry={vi.fn()}
        recruitingCandidateId={candidateA}
        reports={reports}
        state={state}
      />,
    );

    expect(
      screen.getByRole("button", { name: "入学交渉中… 青木 蓮" }),
    ).toBeDisabled();
  });

  it("shows an error with retry and wires the retry action", () => {
    const onRetry = vi.fn();
    render(
      <ScoutingScreen
        error="候補を読み込めませんでした"
        loading={false}
        onBack={vi.fn()}
        onRecruit={vi.fn()}
        onRetry={onRetry}
        recruitingCandidateId={null}
        reports={[]}
        state={stateWithCommitted()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "候補を読み込めませんでした",
    );
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("moves unwanted candidates out of the active list and can restore them", () => {
    render(
      <ScoutingScreen
        error={null}
        loading={false}
        onBack={vi.fn()}
        onRecruit={vi.fn()}
        onRetry={vi.fn()}
        recruitingCandidateId={null}
        reports={reports}
        state={stateWithCommitted()}
      />,
    );

    const activeList = screen.getByRole("region", { name: "スカウト候補一覧" });
    expect(within(activeList).getByText("青木 蓮")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "対象外 青木 蓮" }));

    expect(
      within(
        screen.getByRole("region", { name: "スカウト候補一覧" }),
      ).queryByText("青木 蓮"),
    ).toBeNull();
    const excludedSummary = screen.getByText("対象外 1人");
    expect(excludedSummary).toBeVisible();
    fireEvent.click(excludedSummary);
    expect(
      screen.getByRole("button", { name: "候補に戻す 青木 蓮" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "候補に戻す 青木 蓮" }));

    expect(
      within(
        screen.getByRole("region", { name: "スカウト候補一覧" }),
      ).getByText("青木 蓮"),
    ).toBeVisible();
  });

  it("scopes exclusions to the current recruiting year", () => {
    const state = stateWithCommitted();
    const view = render(
      <ScoutingScreen
        error={null}
        loading={false}
        onBack={vi.fn()}
        onRecruit={vi.fn()}
        onRetry={vi.fn()}
        recruitingCandidateId={null}
        reports={reports}
        state={state}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "対象外 青木 蓮" }));

    const nextYearState = {
      ...state,
      yearIndex: state.yearIndex + 1,
      recruiting: undefined,
    };
    view.rerender(
      <ScoutingScreen
        error={null}
        loading={false}
        onBack={vi.fn()}
        onRecruit={vi.fn()}
        onRetry={vi.fn()}
        recruitingCandidateId={null}
        reports={reports}
        state={nextYearState}
      />,
    );

    expect(
      within(
        screen.getByRole("region", { name: "スカウト候補一覧" }),
      ).getByText("青木 蓮"),
    ).toBeVisible();
  });
  it("opens a compact negotiation sheet for contested prospects and wires recruiting actions", () => {
    const onRecruit = vi.fn();
    const contestedReports: ScoutReport[] = [
      {
        ...reports[0]!,
        recruitment: {
          interestScore: 48,
          interestLevel: "medium",
          canCommit: false,
          competitorSchoolNames: ["皇星", "青凪"],
        },
      },
      reports[1]!,
    ];

    render(
      <ScoutingScreen
        error={null}
        loading={false}
        onBack={vi.fn()}
        onRecruit={onRecruit}
        onRetry={vi.fn()}
        recruitingCandidateId={null}
        reports={contestedReports}
        state={stateWithCommitted()}
      />,
    );

    expect(screen.getByText("志望度 48")).toBeVisible();
    expect(screen.getByText("競合 2校")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "入学交渉 青木 蓮" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "青木 蓮の入学交渉",
    });
    expect(within(dialog).getByText("競合: 皇星 / 青凪")).toBeVisible();
    expect(within(dialog).getByText("志望度60で入学確約できます")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: /入学確約/ }),
    ).toBeDisabled();

    fireEvent.click(
      within(dialog).getByRole("button", { name: /学校訪問/ }),
    );
    expect(onRecruit).toHaveBeenCalledWith(candidateA, "visit");
  });

  it("shows annual visit and recommendation resources in the scouting summary", () => {
    const state = stateWithCommitted();
    state.recruiting = {
      ...state.recruiting!,
      visitActionsUsed: 2,
      recommendationUsed: true,
    };

    render(
      <ScoutingScreen
        error={null}
        loading={false}
        onBack={vi.fn()}
        onRecruit={vi.fn()}
        onRetry={vi.fn()}
        recruitingCandidateId={null}
        reports={reports}
        state={state}
      />,
    );

    const summary = screen.getByLabelText("スカウト状況");
    expect(within(summary).getByText("残2回")).toBeVisible();
    expect(within(summary).getByText("使用済")).toBeVisible();
  });

});
