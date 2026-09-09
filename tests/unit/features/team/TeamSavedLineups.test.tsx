import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { repositionTeamSelection } from "../../../../src/domain/team/repositionTeamSelection";
import { TeamScreen } from "../../../../src/features/team/TeamScreen";

function fixture() {
  const state = createDemoGame();
  const selection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  return { state, selection };
}

function renderSavedLineups(options: {
  state?: ReturnType<typeof createDemoGame>;
  selection?: ReturnType<typeof autoSelectTeam>;
  planningPending?: boolean;
}) {
  const base = fixture();
  const state = options.state ?? base.state;
  const selection =
    options.selection ??
    autoSelectTeam({ state, schoolId: state.userSchoolId });
  const onChange = vi.fn();
  const onSaveLineupPreset = vi.fn();
  const onDeleteLineupPreset = vi.fn();

  render(
    <TeamScreen
      onChange={onChange}
      onDeleteLineupPreset={onDeleteLineupPreset}
      onSaveLineupPreset={onSaveLineupPreset}
      planningPending={options.planningPending}
      selection={selection}
      state={state}
    />,
  );

  return {
    state,
    selection,
    onChange,
    onSaveLineupPreset,
    onDeleteLineupPreset,
  };
}

describe("TeamScreen saved lineups", () => {
  it("shows three empty slots and saves the current lineup with a trimmed name", () => {
    const { selection, onSaveLineupPreset } = renderSavedLineups({});

    expect(screen.getByRole("heading", { name: "保存編成" })).toBeVisible();
    expect(screen.getAllByText("未保存")).toHaveLength(3);

    const slot = screen.getByTestId("saved-lineup-slot-1");
    fireEvent.change(within(slot).getByLabelText("保存編成名 スロット1"), {
      target: { value: "  ベストメンバー  " },
    });
    fireEvent.click(
      within(slot).getByRole("button", { name: "現在の編成を保存" }),
    );

    expect(onSaveLineupPreset).toHaveBeenCalledWith(
      1,
      "ベストメンバー",
      selection,
    );
  });

  it("applies, overwrites, and deletes a valid occupied slot", () => {
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
        name: "速攻型",
        selection: structuredClone(savedSelection!),
      },
    ];

    const { onChange, onSaveLineupPreset, onDeleteLineupPreset } =
      renderSavedLineups({ state, selection });
    const slot = screen.getByTestId("saved-lineup-slot-2");

    expect(within(slot).getByText("使用可能")).toBeVisible();
    expect(within(slot).getByLabelText("保存編成名 スロット2")).toHaveValue(
      "速攻型",
    );

    fireEvent.click(within(slot).getByRole("button", { name: "適用" }));
    expect(onChange).toHaveBeenCalledWith(savedSelection);
    expect(state.teamPlanning.savedLineups[0]!.selection).toEqual(
      savedSelection,
    );

    fireEvent.change(within(slot).getByLabelText("保存編成名 スロット2"), {
      target: { value: "速攻型 改" },
    });
    fireEvent.click(
      within(slot).getByRole("button", { name: "上書き保存" }),
    );
    expect(onSaveLineupPreset).toHaveBeenCalledWith(2, "速攻型 改", selection);

    fireEvent.click(within(slot).getByRole("button", { name: "削除" }));
    expect(onDeleteLineupPreset).toHaveBeenCalledWith(2);
  });

  it("keeps an invalid saved snapshot visible but blocks apply", () => {
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

    renderSavedLineups({ state, selection });
    const slot = screen.getByTestId("saved-lineup-slot-1");

    expect(within(slot).getByText("再設定が必要")).toBeVisible();
    expect(within(slot).getByRole("button", { name: "適用" })).toBeDisabled();
    expect(
      within(slot).getByRole("button", { name: "上書き保存" }),
    ).toBeEnabled();
    expect(within(slot).getByRole("button", { name: "削除" })).toBeEnabled();
  });

  it("disables every saved-lineup operation while planning is pending", () => {
    const { state, selection } = fixture();
    state.teamPlanning.savedLineups = [
      {
        slot: 1,
        name: "通常",
        selection: structuredClone(selection),
      },
    ];

    renderSavedLineups({ state, selection, planningPending: true });

    for (const button of screen.getAllByRole("button", {
      name: /現在の編成を保存|適用|上書き保存|削除/,
    })) {
      expect(button).toBeDisabled();
    }
  });
});
