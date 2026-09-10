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
      id: matchId(`phase16-match-screen-${index}`),
      homeSchoolId: state.userSchoolId,
      awaySchoolId: opponent.id,
      homeSelection,
      awaySelection,
      bestOfSets: 3,
      random: new SeededRandom(`phase16-match-screen-${index}`),
      controlledSchoolId: state.userSchoolId,
    });
    if (result.match.phase === "coach-decision" && result.analysis === null) {
      return { state, opponent, homeSelection, awaySelection, result };
    }
  }

  throw new Error("could not find incomplete Phase16 match fixture");
}

describe("Phase16 MatchScreen authoritative playback", () => {
  it("reveals only the current authoritative segment before showing the coach decision", () => {
    const fixture = findIncompleteDecisionMatch();
    const eventCount = fixture.result.match.eventLog.length;

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

    expect(screen.getByTestId("event-sequence")).toHaveTextContent(
      `1 / ${eventCount}`,
    );
    expect(screen.queryByRole("region", { name: "監督指示" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "試合結果" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "次の判断まで進む" }),
    );

    expect(screen.getByTestId("event-sequence")).toHaveTextContent(
      `${eventCount} / ${eventCount}`,
    );
    expect(screen.getByRole("region", { name: "監督指示" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "試合結果" })).toBeNull();
  });
});
