import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { applyMatchCommand } from "../../../../src/domain/match/applyMatchCommand";
import {
  resumeMatch,
  simulateMatch,
  startMatch,
  type MatchStepResult,
} from "../../../../src/domain/match/simulateMatch";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import {
  calculateSelectionStrength,
  selectPracticeOpponent,
} from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { MatchScreen } from "../../../../src/features/match/MatchScreen";

function fixture() {
  const state = createDemoGame();
  const opponent = selectPracticeOpponent(state);
  const homeSelection = autoSelectTeam({ state, schoolId: state.userSchoolId });
  const awaySelection = autoSelectTeam({ state, schoolId: opponent.id });
  return { state, opponent, homeSelection, awaySelection };
}

function findInteractiveDecision(): ReturnType<typeof fixture> & {
  result: MatchStepResult;
} {
  const base = fixture();

  for (let index = 0; index < 240; index += 1) {
    const result = startMatch({
      state: base.state,
      id: matchId(`phase16-summary-${index}`),
      homeSchoolId: base.state.userSchoolId,
      awaySchoolId: base.opponent.id,
      homeSelection: base.homeSelection,
      awaySelection: base.awaySelection,
      bestOfSets: 3,
      random: new SeededRandom(`phase16-summary-${index}`),
      controlledSchoolId: base.state.userSchoolId,
    });
    if (result.match.phase === "coach-decision") {
      return { ...base, result };
    }
  }

  throw new Error("could not find interactive decision fixture");
}

function completeInteractiveMatch(): ReturnType<
  typeof findInteractiveDecision
> {
  const base = findInteractiveDecision();
  let match = applyMatchCommand({
    state: base.state,
    match: base.result.match,
    schoolId: base.state.userSchoolId,
    command: {
      type: "set-match-tactics",
      plan: { serve: "aggressive", attack: "quick", block: "commit" },
    },
  });
  let result = resumeMatch({ state: base.state, match });

  for (let guard = 0; guard < 12 && result.analysis === null; guard += 1) {
    match = applyMatchCommand({
      state: base.state,
      match: result.match,
      schoolId: base.state.userSchoolId,
      command: { type: "continue" },
    });
    result = resumeMatch({ state: base.state, match });
  }

  if (!result.analysis) throw new Error("interactive fixture did not complete");
  return { ...base, result };
}

function renderMatch(
  base: ReturnType<typeof fixture>,
  result: MatchStepResult,
) {
  return render(
    <MatchScreen
      state={base.state}
      opponent={base.opponent}
      homeSelection={base.homeSelection}
      awaySelection={base.awaySelection}
      homeStrength={calculateSelectionStrength(base.state, base.homeSelection)}
      awayStrength={calculateSelectionStrength(base.state, base.awaySelection)}
      result={result}
      reducedMotion={false}
      onStart={vi.fn()}
      onReturnHome={vi.fn()}
      onCommand={vi.fn()}
    />,
  );
}

describe("Phase16 MatchScreen command presentation", () => {
  it("shows the current match-local tactic plan during live play", () => {
    const base = findInteractiveDecision();
    const result = structuredClone(base.result);
    if (!result.match.runtime) throw new Error("runtime fixture missing");
    result.match.runtime.homeTactics = {
      serve: "aggressive",
      attack: "quick",
      block: "commit",
    };

    renderMatch(base, result);

    const tactics = screen.getByRole("region", { name: "現在戦術" });
    expect(tactics).toHaveTextContent("サーブ 強気");
    expect(tactics).toHaveTextContent("攻撃 高速");
    expect(tactics).toHaveTextContent("ブロック コミット");
  });

  it("shows factual coach-command history after an interactive match completes", () => {
    const base = completeInteractiveMatch();

    renderMatch(base, base.result);
    fireEvent.click(screen.getByRole("button", { name: "結果まで進む" }));

    expect(screen.getByRole("heading", { name: "試合結果" })).toBeVisible();
    const commandImpact = screen.getByRole("region", { name: "監督采配" });
    expect(commandImpact).toHaveTextContent("戦術変更");
    expect(commandImpact).toHaveTextContent("観測");
    expect(commandImpact).not.toHaveTextContent("効果で");
    expect(commandImpact).not.toHaveTextContent("成功させた");
  });

  it("omits coach-command history for a completed one-shot match with no commands", () => {
    const base = fixture();
    const result = simulateMatch({
      state: base.state,
      id: matchId("phase16-summary-legacy"),
      homeSchoolId: base.state.userSchoolId,
      awaySchoolId: base.opponent.id,
      homeSelection: base.homeSelection,
      awaySelection: base.awaySelection,
      bestOfSets: 3,
      random: new SeededRandom("phase16-summary-legacy"),
    });

    renderMatch(base, result);
    fireEvent.click(screen.getByRole("button", { name: "結果まで進む" }));

    expect(screen.queryByRole("region", { name: "監督采配" })).toBeNull();
  });
});
