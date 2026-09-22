import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { PracticeMatchPlanning } from "../../../../src/features/match/PracticeMatchPlanning";

describe("PracticeMatchPlanning", () => {
  it("highlights the candidate matching the current season ambition", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    state.weeklySchedule.practiceMatch.scheduledOpponentId = null;
    state.seasonGoals = {
      ...state.seasonGoals!,
      ambition: "bold",
    };
    const candidate =
      state.weeklySchedule.practiceMatch.outgoingCandidates.find(
        (item) => item.tier === "challenge",
      )!;
    const school = state.schools[candidate.schoolId]!;

    render(
      <PracticeMatchPlanning
        onAcceptOffer={vi.fn()}
        onDeclineOffer={vi.fn()}
        onRequest={vi.fn()}
        pending={false}
        state={state}
      />,
    );

    const schoolName = screen.getByText(school.name);
    const card = schoolName.closest("article") as HTMLElement;
    expect(card).toHaveClass("is-recommended");
    expect(within(card).getByText("方針おすすめ")).toBeVisible();
    expect(within(card).getByText(/強豪/)).toBeVisible();
  });
});
