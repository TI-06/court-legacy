import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { ShopUseResultPanel } from "../../../../src/features/shop/ShopScreen";

describe("contextual shop effect display", () => {
  it("renders real fatigue and condition before/after values", () => {
    render(
      <ShopUseResultPanel
        presentation={{
          itemId: "fatigue-recovery",
          result: {
            before: { fatigue: 55, condition: 62 },
            after: { fatigue: 37, condition: 78 },
          },
        }}
      />,
    );
    expect(screen.getByText("疲労 55 → 37")).toBeVisible();
    expect(screen.getByText("状態 62 → 78")).toBeVisible();
  });

  it("shows ability before/after and actual gains for special-coach", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const after = state.players[playerId]!.abilities.spike;
    render(
      <ShopUseResultPanel
        presentation={{
          itemId: "special-coach",
          result: {
            playerId,
            totalAbilityGrowth: 4,
            fatigueChange: 6,
            abilityChanges: { spike: 4 },
          },
        }}
        state={state}
      />,
    );
    expect(
      screen.getByText(`スパイク ${after - 4} → ${after} (+4)`),
    ).toBeVisible();
    expect(screen.getByText("能力成長 +4")).toBeVisible();
  });

  it("states the upcoming training effect rather than fabricated growth", () => {
    render(
      <ShopUseResultPanel
        presentation={{
          itemId: "training-efficiency-boost",
          result: { pending: true, percent: 15 },
        }}
      />,
    );
    expect(
      screen.getByText("次回練習の成長効率 +15% を有効化しました"),
    ).toBeVisible();
  });
});
