import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { startMatch } from "../../../../src/domain/match/simulateMatch";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import {
  calculateSelectionStrength,
  selectPracticeOpponent,
} from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { MatchScreen } from "../../../../src/features/match/MatchScreen";

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

describe("Phase22 match result skip", () => {
  it("offers result skip from the first visible event without removing normal playback", () => {
    const fixture = findIncompleteDecisionMatch();
    const onCommand = vi.fn();

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
        allowResultSkip
        reducedMotion={false}
        onStart={vi.fn()}
        onReturnHome={vi.fn()}
        onCommand={onCommand}
      />,
    );

    expect(screen.getByTestId("event-sequence")).toHaveTextContent("1 /");
    expect(screen.getByRole("button", { name: "再生" })).toBeVisible();
    expect(screen.getByRole("button", { name: "次のプレー" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "結果までスキップ" }));

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith({ type: "skip-to-result" });
  });

  it("does not expose result skip unless the caller explicitly enables it", () => {
    const fixture = findIncompleteDecisionMatch();

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
      />,
    );

    expect(
      screen.queryByRole("button", { name: "結果までスキップ" }),
    ).toBeNull();
  });
});
