import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { playerId } from "../../../../src/domain/model/identifiers";
import type { ScoutReport } from "../../../../src/domain/scouting/scoutReport";
import { ScoutingScreen } from "../../../../src/features/scouting/ScoutingScreen";

const reports: ScoutReport[] = [
  {
    candidateId: playerId("exclude-a"),
    displayName: "青木 蓮",
    heightCm: 188,
    position: "OH",
    handedness: "right",
    middleSchoolAchievement: "prefectural-selection",
    evaluationStars: 4,
    estimatedOverall: { min: 58, max: 72 },
    estimatedPotential: { min: 72, max: 89 },
    confidence: "medium",
    comments: ["攻撃力に目を引くものがある"],
  },
  {
    candidateId: playerId("exclude-b"),
    displayName: "佐藤 湊",
    heightCm: 181,
    position: "S",
    handedness: "left",
    middleSchoolAchievement: "national-event",
    evaluationStars: 5,
    estimatedOverall: { min: 68, max: 80 },
    estimatedPotential: { min: 82, max: 96 },
    confidence: "high",
    comments: ["トスワークの感覚が良い"],
  },
];

describe("scouting candidate exclusion", () => {
  beforeEach(() => localStorage.clear());

  it("hides an unwanted candidate and can restore that candidate later", () => {
    render(
      <ScoutingScreen
        error={null}
        loading={false}
        onBack={vi.fn()}
        onRecruit={vi.fn()}
        onRetry={vi.fn()}
        recruitingCandidateId={null}
        reports={reports}
        state={createDemoGame()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "対象外 青木 蓮" }));
    expect(
      screen.queryByRole("button", { name: "獲得候補にする 青木 蓮" }),
    ).toBeNull();
    fireEvent.click(screen.getByText("対象外 1人"));
    fireEvent.click(
      screen.getByRole("button", { name: "候補に戻す 青木 蓮" }),
    );
    expect(
      screen.getByRole("button", { name: "獲得候補にする 青木 蓮" }),
    ).toBeEnabled();
  });
});
