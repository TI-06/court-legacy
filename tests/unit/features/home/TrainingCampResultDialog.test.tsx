import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { TrainingCampResult } from "../../../../src/domain/shop/shopEffects";
import { TrainingCampResultDialog } from "../../../../src/features/home/TrainingCampResultDialog";

describe("TrainingCampResultDialog", () => {
  it("presents the deferred camp result as a focused event and acknowledges it", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const result: TrainingCampResult = {
      sourceItemId: "training-camp",
      scheduledDate: state.date,
      participantCount: 15,
      grewPlayerCount: 13,
      totalAbilityGrowth: 41,
      topGrowth: [
        {
          playerId,
          totalAbilityGrowth: 6,
          abilityChanges: { spike: 3, jump: 3 },
        },
      ],
      averageFatigueChange: 11.2,
      injuredPlayerIds: [],
    };
    const onAcknowledge = vi.fn();

    render(
      <TrainingCampResultDialog
        onAcknowledge={onAcknowledge}
        pending={false}
        result={result}
        state={state}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "強化合宿の結果" }),
    ).toBeVisible();
    const summary = screen.getByLabelText("強化合宿サマリー");
    expect(within(summary).getByText("参加")).toBeVisible();
    expect(within(summary).getByText("15人")).toBeVisible();
    expect(within(summary).getByText("能力成長")).toBeVisible();
    expect(within(summary).getByText("+41")).toBeVisible();
    expect(within(summary).getByText("平均疲労")).toBeVisible();
    expect(within(summary).getByText("+11.2")).toBeVisible();
    expect(within(summary).getByText("怪我")).toBeVisible();
    expect(within(summary).getByText("0人")).toBeVisible();
    expect(
      screen.getByText(`${player.lastName} ${player.firstName}`),
    ).toBeVisible();
    expect(screen.getByText("+6")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "結果を確認した" }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });
});
