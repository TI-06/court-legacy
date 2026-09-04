import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "../../../src/App";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { simulateMatch } from "../../../src/domain/match/simulateMatch";
import { matchId } from "../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../src/domain/random/SeededRandom";
import {
  calculateSelectionStrength,
  selectPracticeOpponent,
} from "../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import { MatchScreen } from "../../../src/features/match/MatchScreen";
import { PracticeMatchPlanning } from "../../../src/features/match/PracticeMatchPlanning";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { applyGameAction } from "../../../worker/game/applyGameAction";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase13-game-loop-polish",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高橋 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });

  return {
    userId: "phase13-user",
    schoolDbId: "00000000-0000-4000-8000-000000000013",
    revision: 13,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function createMatchFixture() {
  const state = createDemoGame();
  const opponent = selectPracticeOpponent(state);
  state.weeklySchedule.practiceMatch.scheduledOpponentId = opponent.id;
  state.weeklySchedule.practiceMatch.scheduledBy = "outgoing";
  const homeSelection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const awaySelection = autoSelectTeam({ state, schoolId: opponent.id });
  const result = simulateMatch({
    state,
    id: matchId("phase13-result-ux"),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponent.id,
    homeSelection,
    awaySelection,
    bestOfSets: 3,
    random: new SeededRandom("phase13-result-ux"),
  });

  return {
    state,
    opponent,
    homeSelection,
    awaySelection,
    homeStrength: calculateSelectionStrength(state, homeSelection),
    awayStrength: calculateSelectionStrength(state, awaySelection),
    result,
  };
}

describe("Phase 13 game loop polish", () => {
  it("clears a completed practice reservation and refreshes practice planning for the next week", () => {
    const snapshot = createSnapshot();
    const opponent = Object.values(snapshot.state.schools).find(
      (school) => school.id !== snapshot.state.userSchoolId,
    );
    if (!opponent) {
      throw new Error("practice opponent fixture missing");
    }

    const scheduledSnapshot: CloudGameSnapshot = {
      ...snapshot,
      state: {
        ...snapshot.state,
        weeklySchedule: {
          ...snapshot.state.weeklySchedule,
          practiceMatch: {
            incomingOffer: null,
            outgoingCandidates: [
              {
                schoolId: opponent.id,
                tier: "same",
                acceptancePercent: 100,
                growthRating: 3,
                status: "accepted",
              },
            ],
            scheduledOpponentId: opponent.id,
            scheduledBy: "outgoing",
          },
        },
      },
    };

    const played = applyGameAction(scheduledSnapshot, {
      type: "practice-match",
    });

    expect(played.state.weeklySchedule.practiceMatch.scheduledOpponentId).toBe(
      null,
    );
    expect(played.state.weeklySchedule.practiceMatch.scheduledBy).toBe(null);

    const advanced = applyGameAction(
      {
        ...scheduledSnapshot,
        state: played.state,
        teamSelection: played.teamSelection,
      },
      { type: "advance-week" },
    );

    expect(advanced.state.date).not.toBe(played.state.date);
    expect(
      advanced.state.weeklySchedule.practiceMatch.scheduledOpponentId,
    ).toBeNull();
    expect(
      advanced.state.weeklySchedule.practiceMatch.outgoingCandidates.every(
        (candidate) => candidate.status === "available",
      ),
    ).toBe(true);
  });

  it("shows the match result from the user's perspective with an always-available continuation bar", () => {
    const fixture = createMatchFixture();
    const userWon =
      fixture.result.analysis.winnerSchoolId === fixture.state.userSchoolId;

    render(
      <MatchScreen
        {...fixture}
        onReturnHome={vi.fn()}
        onStart={vi.fn()}
        reducedMotion={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "結果まで進む" }));

    expect(screen.getByTestId("match-result-verdict")).toHaveTextContent(
      userWon ? "勝利" : "敗北",
    );
    expect(screen.getByText("あなた")).toBeVisible();
    expect(screen.getByTestId("match-result-actions")).toHaveClass(
      "match-result-actions--fixed",
    );
  });

  it("uses explicit readable contrast for sheets and the practice-match decline action", () => {
    const state = createDemoGame();
    const offerSchool = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    );
    if (!offerSchool) {
      throw new Error("offer school fixture missing");
    }
    state.weeklySchedule.practiceMatch = {
      incomingOffer: {
        schoolId: offerSchool.id,
        growthRating: 3,
        loadRating: 3,
      },
      outgoingCandidates: [],
      scheduledOpponentId: null,
      scheduledBy: null,
    };

    render(
      <PracticeMatchPlanning
        onAcceptOffer={vi.fn()}
        onDeclineOffer={vi.fn()}
        onRequest={vi.fn()}
        pending={false}
        state={state}
      />,
    );

    expect(screen.getByRole("button", { name: "断る" })).toHaveClass(
      "practice-planning__decline",
    );

    const uiCss = readFileSync(join(process.cwd(), "src/ui/ui.css"), "utf8");
    const practiceCss = readFileSync(
      join(process.cwd(), "src/features/match/practice-match-planning.css"),
      "utf8",
    );

    expect(uiCss).toMatch(/\.ui-bottom-sheet\s*\{[^}]*color:\s*#203743;/s);
    expect(practiceCss).toMatch(
      /\.practice-planning__decline\s*\{[^}]*color:\s*#8b3a2d;[^}]*background:\s*#fff0ec;/s,
    );
  });

  it("uses the compact school hero and mobile result action layout", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "学校" }));

    expect(screen.getByTestId("school-hero")).toHaveClass(
      "school-hero--compact",
    );

    const schoolCss = readFileSync(
      join(process.cwd(), "src/features/school/school-screen.css"),
      "utf8",
    );
    const matchCss = readFileSync(
      join(process.cwd(), "src/features/match/match.css"),
      "utf8",
    );

    expect(schoolCss).toMatch(
      /\.school-summary-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s,
    );
    expect(matchCss).toMatch(
      /\.match-result-actions--fixed\s*\{[^}]*position:\s*fixed;/s,
    );
  });
});
