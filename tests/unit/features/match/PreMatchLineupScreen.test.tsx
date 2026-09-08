import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PreMatchLineupScreen } from "../../../../src/features/match/PreMatchLineupScreen";

function fixture() {
  const state = createDemoGame();
  const selection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  return { state, selection };
}

describe("PreMatchLineupScreen", () => {
  it("keeps match-only presets and manual starter swaps local until start", () => {
    const { state, selection } = fixture();
    const onStart = vi.fn();
    const onCancel = vi.fn();
    const original = structuredClone(selection);

    render(
      <PreMatchLineupScreen
        baseSelection={selection}
        mode="pve"
        onCancel={onCancel}
        onStart={onStart}
        opponentName="ライバル高校"
        opponentStrength={78}
        pending={false}
        state={state}
      />,
    );

    expect(screen.getByRole("heading", { name: "試合準備" })).toBeInTheDocument();
    expect(screen.getByText("この試合だけの編成です")).toBeInTheDocument();
    expect(screen.getByText("ライバル高校")).toBeInTheDocument();
    expect(screen.getByText("戦力 78")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1年中心" }));
    expect(selection).toEqual(original);

    const firstBenchId = original.benchPlayerIds[0];
    expect(firstBenchId).toBeDefined();
    fireEvent.change(screen.getByLabelText("ローテーション1"), {
      target: { value: firstBenchId },
    });

    fireEvent.click(screen.getByRole("button", { name: "この編成で試合開始" }));
    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart.mock.calls[0]?.[0]).not.toEqual(original);
    expect(selection).toEqual(original);
  });

  it("can restore the saved lineup after applying a preset", () => {
    const { state, selection } = fixture();
    const onStart = vi.fn();

    render(
      <PreMatchLineupScreen
        baseSelection={selection}
        mode="pvp"
        onCancel={vi.fn()}
        onStart={onStart}
        opponentName="オンライン高校"
        opponentStrength={91}
        pending={false}
        state={state}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "調子優先" }));
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    fireEvent.click(screen.getByRole("button", { name: "この編成で試合開始" }));

    expect(onStart).toHaveBeenCalledWith(selection);
  });
});
