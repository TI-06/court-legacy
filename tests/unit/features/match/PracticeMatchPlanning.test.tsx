import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  matchId,
  type GameDate,
} from "../../../../src/domain/model/identifiers";
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

  it("requests the recommended opponent directly from the shortcut", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    state.weeklySchedule.practiceMatch.scheduledOpponentId = null;
    state.seasonGoals = {
      ...state.seasonGoals!,
      ambition: "bold",
    };
    const recommended =
      state.weeklySchedule.practiceMatch.outgoingCandidates.find(
        (item) => item.tier === "challenge",
      )!;
    const school = state.schools[recommended.schoolId]!;
    const onRequest = vi.fn();

    render(
      <PracticeMatchPlanning
        onAcceptOffer={vi.fn()}
        onDeclineOffer={vi.fn()}
        onRequest={onRequest}
        pending={false}
        state={state}
      />,
    );

    const shortcut = screen.getByRole("article", {
      name: "方針おすすめの練習試合",
    });
    expect(within(shortcut).getByText(/野心方針なら/)).toBeVisible();

    fireEvent.click(
      within(shortcut).getByRole("button", {
        name: `${school.name}におすすめから申し込む`,
      }),
    );

    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRequest).toHaveBeenCalledWith(recommended.schoolId);
  });

  it("labels the shortcut as last-match advice when a recent practice result exists", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    state.weeklySchedule.practiceMatch.scheduledOpponentId = null;
    const previous =
      state.weeklySchedule.practiceMatch.outgoingCandidates[0]!;
    const previousDate = "2026-04-01" as GameDate;
    state.weeklySchedule.recentPracticeMatches = [
      { opponentSchoolId: previous.schoolId, date: previousDate },
    ];
    state.history.matches.push({
      matchId: matchId("phase29-4-ui-loss"),
      date: previousDate,
      homeSchoolId: state.userSchoolId,
      awaySchoolId: previous.schoolId,
      winnerSchoolId: previous.schoolId,
      homeSetsWon: 0,
      awaySetsWon: 2,
      tournamentId: null,
    });

    render(
      <PracticeMatchPlanning
        onAcceptOffer={vi.fn()}
        onDeclineOffer={vi.fn()}
        onRequest={vi.fn()}
        pending={false}
        state={state}
      />,
    );

    const shortcut = screen.getByRole("article", {
      name: "前回結果おすすめの練習試合",
    });
    expect(within(shortcut).getByText("LAST MATCH ADVICE")).toBeVisible();
    expect(within(shortcut).getByText(/前回敗戦を踏まえ/)).toBeVisible();
    expect(screen.getByText("前回結果")).toBeVisible();
  });

  it("moves the shortcut to the next available recommendation after rejection", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    state.weeklySchedule.practiceMatch.scheduledOpponentId = null;
    state.seasonGoals = {
      ...state.seasonGoals!,
      ambition: "bold",
    };
    const challenge =
      state.weeklySchedule.practiceMatch.outgoingCandidates.find(
        (item) => item.tier === "challenge",
      )!;
    const stronger = state.weeklySchedule.practiceMatch.outgoingCandidates.find(
      (item) => item.tier === "stronger",
    )!;
    const challengeSchool = state.schools[challenge.schoolId]!;
    const strongerSchool = state.schools[stronger.schoolId]!;

    const { rerender } = render(
      <PracticeMatchPlanning
        onAcceptOffer={vi.fn()}
        onDeclineOffer={vi.fn()}
        onRequest={vi.fn()}
        pending={false}
        state={state}
      />,
    );

    let shortcut = screen.getByRole("article", {
      name: "方針おすすめの練習試合",
    });
    expect(shortcut).toHaveTextContent(challengeSchool.name);

    const rejectedState = structuredClone(state);
    rejectedState.weeklySchedule.practiceMatch.outgoingCandidates =
      rejectedState.weeklySchedule.practiceMatch.outgoingCandidates.map(
        (candidate) =>
          candidate.schoolId === challenge.schoolId
            ? { ...candidate, status: "rejected" as const }
            : candidate,
      );

    rerender(
      <PracticeMatchPlanning
        onAcceptOffer={vi.fn()}
        onDeclineOffer={vi.fn()}
        onRequest={vi.fn()}
        pending={false}
        state={rejectedState}
      />,
    );

    shortcut = screen.getByRole("article", {
      name: "方針おすすめの練習試合",
    });
    expect(shortcut).toHaveTextContent(strongerSchool.name);
    expect(shortcut).not.toHaveTextContent(challengeSchool.name);
    expect(within(shortcut).getByText(/格上/)).toBeVisible();
  });
});
