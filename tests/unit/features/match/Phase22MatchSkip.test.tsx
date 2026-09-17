import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { PendingMatchPresentation } from "../../../../src/domain/calendar/advanceWeekOutcome";
import { startMatch } from "../../../../src/domain/match/simulateMatch";
import { matchId, type SchoolId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import {
  calculateSelectionStrength,
  selectPracticeOpponent,
} from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { MatchScreen } from "../../../../src/features/match/MatchScreen";
import { skipMatchToResult } from "../../../../src/features/match/skipMatchToResult";

function findIncompleteDecisionMatch() {
  const state = createDemoGame();
  const opponent = selectPracticeOpponent(state);
  const homeSelection = autoSelectTeam({ state, schoolId: state.userSchoolId });
  const awaySelection = autoSelectTeam({ state, schoolId: opponent.id });

  for (let index = 0; index < 240; index += 1) {
    const result = startMatch({
      state,
      id: matchId(`phase22-match-skip-${index}`),
      homeSchoolId: state.userSchoolId,
      awaySchoolId: opponent.id,
      homeSelection,
      awaySelection,
      bestOfSets: 3,
      random: new SeededRandom(`phase22-match-skip-${index}`),
      controlledSchoolId: state.userSchoolId,
    });
    if (result.match.phase === "coach-decision" && result.analysis === null) {
      return { state, opponent, homeSelection, awaySelection, result };
    }
  }

  throw new Error("could not find incomplete Phase22 match fixture");
}

function fakePresentation(input: {
  cursor: number;
  complete?: boolean;
}): PendingMatchPresentation {
  const schoolA = "school.phase22-a" as SchoolId;
  const schoolB = "school.phase22-b" as SchoolId;
  return {
    kind: "practice",
    homeTeam: { schoolId: schoolA, displayName: "A高校", shortName: "A" },
    awayTeam: { schoolId: schoolB, displayName: "B高校", shortName: "B" },
    simulation: {
      analysis: input.complete
        ? {
            matchId: matchId("phase22-same-session"),
            winnerSchoolId: schoolA,
            principalFactors: [],
            recommendations: [],
          }
        : null,
      match: {
        id: matchId("phase22-same-session"),
        homeSchoolId: schoolA,
        awaySchoolId: schoolB,
        homeSelection: {} as never,
        awaySelection: {} as never,
        bestOfSets: 3,
        phase: input.complete ? "match-complete" : "coach-decision",
        currentSetNumber: 1,
        homeSetsWon: input.complete ? 2 : 0,
        awaySetsWon: 0,
        sets: [],
        servingSchoolId: schoolA,
        pendingCoachCommandForSchoolId: input.complete ? null : schoolA,
        eventLog: [],
        randomSeed: "phase22-authoritative-seed",
        randomCursor: input.cursor,
      },
    },
  };
}

describe("Phase22 match result skip", () => {
  it("offers result skip from the first visible event without removing normal playback", () => {
    const fixture = findIncompleteDecisionMatch();
    const onSkipToResult = vi.fn();

    render(
      <MatchScreen
        state={fixture.state}
        opponent={fixture.opponent}
        homeSelection={fixture.homeSelection}
        awaySelection={fixture.awaySelection}
        homeStrength={calculateSelectionStrength(
          fixture.state,
          fixture.homeSelection,
        )}
        awayStrength={calculateSelectionStrength(
          fixture.state,
          fixture.awaySelection,
        )}
        result={fixture.result}
        reducedMotion={false}
        onStart={vi.fn()}
        onReturnHome={vi.fn()}
        onCommand={vi.fn()}
        onSkipToResult={onSkipToResult}
      />,
    );

    expect(screen.getByTestId("event-sequence")).toHaveTextContent("1 /");
    expect(screen.getByRole("button", { name: "再生" })).toBeVisible();
    expect(screen.getByRole("button", { name: "次のプレー" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "結果までスキップ" }));

    expect(onSkipToResult).toHaveBeenCalledTimes(1);
  });

  it("continues the same authoritative match session until a terminal result is returned", async () => {
    const initial = fakePresentation({ cursor: 12 });
    const second = fakePresentation({ cursor: 37 });
    const terminal = fakePresentation({ cursor: 81, complete: true });
    const responses = [second, terminal];
    let calls = 0;

    const result = await skipMatchToResult({
      initial,
      controlledSchoolId: initial.homeTeam.schoolId,
      continueMatch: async () => responses[calls++] ?? null,
    });

    expect(calls).toBe(2);
    expect(result).toBe(terminal);
    expect(result?.simulation.match.id).toBe(initial.simulation.match.id);
    expect(result?.simulation.match.randomSeed).toBe(
      initial.simulation.match.randomSeed,
    );
    expect(result?.simulation.analysis).not.toBeNull();
  });
});
