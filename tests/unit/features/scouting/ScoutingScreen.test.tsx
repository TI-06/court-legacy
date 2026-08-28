import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { playerId } from "../../../../src/domain/model/identifiers";
import type { ScoutReport } from "../../../../src/domain/scouting/scoutReport";
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
    confidence: "high",
    comments: ["トスワークの感覚が良い", "大舞台の経験がある"],
  },
];

function stateWithCommitted(candidateIds: typeof candidateA[] = []) {
  const state = createDemoGame();
  state.recruiting = {
    cycleKey: `${state.userSchoolId}:year-${state.yearIndex}`,
    committedCandidateIds: candidateIds,
  };
  return state;
}

describe("ScoutingScreen", () => {
  it("renders only the public scouting report fields and recruiting status", () => {
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
    expect(screen.getByText("青木 蓮")).toBeVisible();
    expect(screen.getByText(/OH/)).toBeVisible();
    expect(screen.getByText(/188cm/)).toBeVisible();
    expect(screen.getByText(/県選抜/)).toBeVisible();
    expect(screen.getByText(/★★★★☆/)).toBeVisible();
    expect(screen.getByText(/現在能力 58〜72/)).toBeVisible();
    expect(screen.getByText(/将来性 72〜89/)).toBeVisible();
    expect(screen.getByText(/調査精度 中/)).toBeVisible();
    expect(screen.getByText("攻撃力に目を引くものがある")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "獲得候補にする 青木 蓮" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "獲得済み 佐藤 湊" })).toBeDisabled();
    expect(screen.queryByText(/monster|generational|potential 96/)).toBeNull();
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
});
