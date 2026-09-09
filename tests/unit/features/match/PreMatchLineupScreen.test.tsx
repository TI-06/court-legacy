import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { repositionTeamSelection } from "../../../../src/domain/team/repositionTeamSelection";
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

    expect(
      screen.getByRole("heading", { name: "試合準備" }),
    ).toBeInTheDocument();
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

  it("loads a valid saved lineup locally and starts with it without mutating stored selections", () => {
    const { state, selection } = fixture();
    const originalBase = structuredClone(selection);
    const benchId = selection.benchPlayerIds[0]!;
    const savedSelection = repositionTeamSelection({
      selection,
      source: { type: "bench", playerId: benchId },
      target: { type: "rotation", slot: 1 },
    });
    expect(savedSelection).not.toBeNull();
    state.teamPlanning.savedLineups = [
      {
        slot: 1,
        name: "速攻型",
        selection: structuredClone(savedSelection!),
      },
    ];
    const originalSaved = structuredClone(
      state.teamPlanning.savedLineups[0]!.selection,
    );
    const onStart = vi.fn();

    render(
      <PreMatchLineupScreen
        baseSelection={selection}
        mode="pve"
        onCancel={vi.fn()}
        onStart={onStart}
        opponentName="ライバル高校"
        opponentStrength={80}
        pending={false}
        state={state}
      />,
    );

    const savedButton = screen.getByRole("button", { name: "保存編成 速攻型" });
    expect(savedButton).toBeVisible();
    fireEvent.click(savedButton);
    fireEvent.click(screen.getByRole("button", { name: "この編成で試合開始" }));

    expect(onStart).toHaveBeenCalledWith(savedSelection);
    expect(selection).toEqual(originalBase);
    expect(state.teamPlanning.savedLineups[0]!.selection).toEqual(
      originalSaved,
    );
  });

  it("keeps stale saved lineups visible but disabled and preserves generated presets", () => {
    const { state, selection } = fixture();
    const removedId = selection.rotation[0]!.playerId;
    state.teamPlanning.savedLineups = [
      {
        slot: 1,
        name: "旧スタメン",
        selection: structuredClone(selection),
      },
    ];
    state.schools[state.userSchoolId]!.playerIds = state.schools[
      state.userSchoolId
    ]!.playerIds.filter((id) => id !== removedId);
    const currentSelection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });

    render(
      <PreMatchLineupScreen
        baseSelection={currentSelection}
        mode="pvp"
        onCancel={vi.fn()}
        onStart={vi.fn()}
        opponentName="オンライン高校"
        opponentStrength={91}
        pending={false}
        state={state}
      />,
    );

    const invalidButton = screen.getByRole("button", {
      name: /保存編成 旧スタメン 再設定が必要/,
    });
    expect(invalidButton).toBeDisabled();
    expect(screen.getByText(/再設定が必要/)).toBeVisible();

    for (const label of [
      "ベスト",
      "1年中心",
      "2年中心",
      "3年中心",
      "調子優先",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeVisible();
    }
  });

  it("lets generated presets and reset replace a temporarily loaded saved lineup", () => {
    const { state, selection } = fixture();
    const benchId = selection.benchPlayerIds[0]!;
    const savedSelection = repositionTeamSelection({
      selection,
      source: { type: "bench", playerId: benchId },
      target: { type: "rotation", slot: 1 },
    });
    expect(savedSelection).not.toBeNull();
    state.teamPlanning.savedLineups = [
      {
        slot: 2,
        name: "守備型",
        selection: structuredClone(savedSelection!),
      },
    ];
    const onStart = vi.fn();

    render(
      <PreMatchLineupScreen
        baseSelection={selection}
        mode="pve"
        onCancel={vi.fn()}
        onStart={onStart}
        opponentName="ライバル高校"
        opponentStrength={80}
        pending={false}
        state={state}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "保存編成 守備型" }));
    fireEvent.click(screen.getByRole("button", { name: "調子優先" }));
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    fireEvent.click(screen.getByRole("button", { name: "この編成で試合開始" }));

    expect(onStart).toHaveBeenCalledWith(selection);
  });
});
