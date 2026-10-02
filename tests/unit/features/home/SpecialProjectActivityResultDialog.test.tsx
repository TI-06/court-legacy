import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { UniversityJointTrainingResult } from "../../../../src/domain/school/specialProjectActivities";
import { SpecialProjectActivityResultDialog } from "../../../../src/features/home/SpecialProjectActivityResultDialog";

describe("SpecialProjectActivityResultDialog", () => {
  it("shows the joint-training summary, top growth, and closes locally", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const result: UniversityJointTrainingResult = {
      focus: "defense",
      participantCount: 12,
      grewPlayerCount: 9,
      totalAbilityGrowth: 24,
      injuredPlayerIds: [],
      averageFatigueChange: 8,
      playerLogs: [
        {
          playerId,
          abilityChanges: { receive: 3, block: 2 },
          totalAbilityGrowth: 5,
          fatigueChange: 8,
          conditionChange: 0,
          trustChange: 1,
          academicRestricted: false,
          injuryRisk: 4,
          injury: null,
          skippedReason: null,
          modifiers: [],
          socialGrowth: {
            percent: 100,
            strongestPositiveLabel: null,
            strongestNegativeLabel: null,
          },
        },
      ],
    };
    const onClose = vi.fn();

    render(
      <SpecialProjectActivityResultDialog
        onClose={onClose}
        result={result}
        state={state}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "大学チーム合同練習の結果" }),
    ).toBeVisible();
    expect(screen.getByText("守備をテーマにした合同練習が終了しました。")).toBeVisible();

    const summary = screen.getByLabelText("大学合同練習サマリー");
    expect(within(summary).getByText("12人")).toBeVisible();
    expect(within(summary).getByText("+24")).toBeVisible();
    expect(within(summary).getByText("+8")).toBeVisible();
    expect(within(summary).getByText("0人")).toBeVisible();

    expect(
      screen.getByText(`${player.lastName} ${player.firstName}`),
    ).toBeVisible();
    expect(screen.getByText("+5")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "結果を確認した" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
