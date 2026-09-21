import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { MatchState } from "../../../../src/domain/model/Match";
import { matchId } from "../../../../src/domain/model/identifiers";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { MatchResultStoryPanel } from "../../../../src/features/match/MatchResultStoryPanel";

describe("MatchResultStoryPanel", () => {
  it("renders a compact first-meeting story from local PVE match facts", () => {
    const state = createDemoGame();
    const opponent = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    const match: MatchState = {
      id: matchId("phase26-5-panel"),
      homeSchoolId: state.userSchoolId,
      awaySchoolId: opponent.id,
      homeSelection: autoSelectTeam({
        state,
        schoolId: state.userSchoolId,
      }),
      awaySelection: autoSelectTeam({ state, schoolId: opponent.id }),
      bestOfSets: 3,
      phase: "match-complete",
      currentSetNumber: 2,
      homeSetsWon: 2,
      awaySetsWon: 0,
      sets: [
        {
          setNumber: 1,
          homeScore: 25,
          awayScore: 20,
          completed: true,
          winnerSchoolId: state.userSchoolId,
        },
        {
          setNumber: 2,
          homeScore: 25,
          awayScore: 18,
          completed: true,
          winnerSchoolId: state.userSchoolId,
        },
      ],
      servingSchoolId: state.userSchoolId,
      pendingCoachCommandForSchoolId: null,
      eventLog: [],
      randomSeed: "phase26-5-panel",
      randomCursor: 0,
    };

    render(<MatchResultStoryPanel match={match} state={state} />);

    const story = screen.getByRole("region", {
      name: "今回の試合の物語",
    });
    expect(within(story).getByText("MATCH STORY")).toBeVisible();
    expect(within(story).getByText("通算 1勝0敗")).toBeVisible();
    expect(within(story).getByText("初対戦")).toBeVisible();
    expect(within(story).getByText("ストレート勝ち")).toBeVisible();
    expect(within(story).getByText("セット 2-0")).toBeVisible();
  });
});
