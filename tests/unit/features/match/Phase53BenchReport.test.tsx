import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { resumeMatch, startMatch } from "../../../../src/domain/match/simulateMatch";
import { applyMatchCommand } from "../../../../src/domain/match/applyMatchCommand";
import type { CoachDecisionReason } from "../../../../src/domain/model/Match";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { MatchCommandPanel } from "../../../../src/features/match/MatchCommandPanel";
import type { LiveMatchInsight } from "../../../../src/features/match/liveMatchIntelligence";

function findDecision(reason: CoachDecisionReason) {
  const state = createDemoGame();
  const opponent = selectPracticeOpponent(state);
  const homeSelection = autoSelectTeam({ state, schoolId: state.userSchoolId });
  const awaySelection = autoSelectTeam({ state, schoolId: opponent.id });

  for (let index = 0; index < 240; index += 1) {
    let step = startMatch({
      state,
      id: matchId(`phase53-bench-report-${reason}-${index}`),
      homeSchoolId: state.userSchoolId,
      awaySchoolId: opponent.id,
      homeSelection,
      awaySelection,
      bestOfSets: 3,
      random: new SeededRandom(`phase53-bench-report-${reason}-${index}`),
      controlledSchoolId: state.userSchoolId,
    });

    for (let guard = 0; guard < 16; guard += 1) {
      if (step.match.runtime?.pendingDecisionReason === reason) {
        return { state, match: step.match };
      }
      if (step.match.phase === "match-complete") break;

      const commanded = applyMatchCommand({
        state,
        match: step.match,
        schoolId: state.userSchoolId,
        command: { type: "continue" },
      });
      step = resumeMatch({ state, match: commanded });
    }
  }

  throw new Error(`could not find ${reason} decision fixture`);
}

function playerName(
  state: ReturnType<typeof createDemoGame>,
  playerId: keyof ReturnType<typeof createDemoGame>["players"],
): string {
  const player = state.players[playerId];
  if (!player) throw new Error(`player fixture missing: ${playerId}`);
  return `${player.lastName} ${player.firstName}`;
}

describe("Phase53 bench report", () => {
  it("shows observed-play advice and opens the matching player instruction", () => {
    const fixture = findDecision("opponent-run");
    const selection =
      fixture.match.homeSchoolId === fixture.state.userSchoolId
        ? fixture.match.homeSelection
        : fixture.match.awaySelection;
    const attackerId = selection.rotation
      .map((assignment) => assignment.playerId)
      .find(
        (playerId) =>
          fixture.state.players[playerId]?.preferredPosition !== "L",
      );
    if (!attackerId) throw new Error("attacker fixture missing");

    const attacker = playerName(fixture.state, attackerId);
    const insight: LiveMatchInsight = {
      kind: "hot-attacker",
      priority: 75,
      headline: `${attacker}が攻撃好調`,
      detail: "アタック 5/8・決定率63%",
      suggestedCommand: "focus-attacker",
      targetPlayerId: attackerId,
      sampleSize: 8,
    };

    render(
      <MatchCommandPanel
        benchInsights={[insight]}
        state={fixture.state}
        match={fixture.match}
        pending={false}
        onCommand={vi.fn()}
      />,
    );

    const report = screen.getByRole("region", { name: "ベンチレポート" });
    expect(within(report).getByText("BENCH REPORT")).toBeVisible();
    expect(within(report).getByText(insight.headline)).toBeVisible();
    expect(within(report).getByText(insight.detail)).toBeVisible();

    fireEvent.click(
      within(report).getByRole("button", { name: "個人指示を見る" }),
    );

    const dialog = screen.getByRole("dialog", { name: "選手指示" });
    const recommendations = within(dialog).getByLabelText("おすすめ個人指示");
    expect(within(recommendations).getByText(attacker)).toBeVisible();
    expect(within(recommendations).getByText(insight.detail)).toBeVisible();
  });

  it("requires an explicit tap before executing a timeout suggestion", () => {
    const fixture = findDecision("opponent-run");
    const onCommand = vi.fn();
    const insight: LiveMatchInsight = {
      kind: "opponent-run",
      priority: 104,
      headline: "4連続失点",
      detail: "直近5得点は自校1 - 相手4",
      suggestedCommand: "timeout",
      targetPlayerId: null,
      sampleSize: 4,
    };

    render(
      <MatchCommandPanel
        benchInsights={[insight]}
        state={fixture.state}
        match={fixture.match}
        pending={false}
        onCommand={onCommand}
      />,
    );

    expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "タイムアウトを取る" }),
    );
    expect(onCommand).toHaveBeenCalledOnce();
    expect(onCommand).toHaveBeenCalledWith({ type: "timeout" });
  });

  it("drops stale player-target advice instead of offering an invalid command", () => {
    const fixture = findDecision("opponent-run");
    const selection =
      fixture.match.homeSchoolId === fixture.state.userSchoolId
        ? fixture.match.homeSelection
        : fixture.match.awaySelection;
    const benchPlayerId = selection.benchPlayerIds[0];
    if (!benchPlayerId) throw new Error("bench fixture missing");

    const staleInsight: LiveMatchInsight = {
      kind: "hot-attacker",
      priority: 75,
      headline: "交代済み選手が攻撃好調",
      detail: "古い観測候補",
      suggestedCommand: "focus-attacker",
      targetPlayerId: benchPlayerId,
      sampleSize: 5,
    };

    render(
      <MatchCommandPanel
        benchInsights={[staleInsight]}
        state={fixture.state}
        match={fixture.match}
        pending={false}
        onCommand={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("region", { name: "ベンチレポート" }),
    ).toBeNull();
  });
});
