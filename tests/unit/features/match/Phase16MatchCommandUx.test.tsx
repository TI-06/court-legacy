import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { startMatch } from "../../../../src/domain/match/simulateMatch";
import type { CoachDecisionReason } from "../../../../src/domain/model/Match";
import { matchId } from "../../../../src/domain/model/identifiers";
import { getPlayerConditionPresentation } from "../../../../src/domain/player/playerCondition";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import { calculatePlayerDisplayPower } from "../../../../src/domain/selectors/playerPresentation";
import { ratingToGrade } from "../../../../src/domain/selectors/ratingGrades";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { MatchCommandPanel } from "../../../../src/features/match/MatchCommandPanel";
import { tacticOptionLabel } from "../../../../src/features/team/tacticsPresentation";

function findDecision(reason: CoachDecisionReason) {
  const state = createDemoGame();
  const opponent = selectPracticeOpponent(state);
  const homeSelection = autoSelectTeam({ state, schoolId: state.userSchoolId });
  const awaySelection = autoSelectTeam({ state, schoolId: opponent.id });

  for (let index = 0; index < 240; index += 1) {
    const step = startMatch({
      state,
      id: matchId(`phase16-command-panel-${reason}-${index}`),
      homeSchoolId: state.userSchoolId,
      awaySchoolId: opponent.id,
      homeSelection,
      awaySelection,
      bestOfSets: 3,
      random: new SeededRandom(`phase16-command-panel-${reason}-${index}`),
      controlledSchoolId: state.userSchoolId,
    });
    if (step.match.runtime?.pendingDecisionReason === reason) {
      return { state, match: step.match };
    }
  }

  throw new Error(`could not find ${reason} decision fixture`);
}

function playerName(
  state: ReturnType<typeof createDemoGame>,
  playerId: string,
): string {
  const player = state.players[playerId];
  if (!player) throw new Error(`player fixture missing: ${playerId}`);
  return `${player.lastName} ${player.firstName}`;
}

describe("Phase16 match command decision panel", () => {
  it("shows the four coach actions at an opponent four-point run and emits complete direct commands", () => {
    const fixture = findDecision("opponent-run");
    const onCommand = vi.fn();

    render(
      <MatchCommandPanel
        state={fixture.state}
        match={fixture.match}
        pending={false}
        onCommand={onCommand}
      />,
    );

    expect(screen.getByText("相手に4連続ポイントを許しています")).toBeVisible();
    expect(screen.getByRole("heading", { name: "監督指示" })).toBeVisible();
    expect(screen.getByRole("button", { name: "タイムアウト" })).toBeVisible();
    expect(screen.getByRole("button", { name: "戦術変更" })).toBeVisible();
    expect(screen.getByRole("button", { name: "選手交代" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "このまま続ける" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "タイムアウト" }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "timeout" });

    fireEvent.click(screen.getByRole("button", { name: "このまま続ける" }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "continue" });
  });

  it("uses set-break copy, hides timeout, and continues to the next set", () => {
    const fixture = findDecision("set-break");
    const onCommand = vi.fn();

    render(
      <MatchCommandPanel
        state={fixture.state}
        match={fixture.match}
        pending={false}
        onCommand={onCommand}
      />,
    );

    expect(screen.getByText("セット間の監督指示")).toBeVisible();
    expect(screen.queryByRole("button", { name: "タイムアウト" })).toBeNull();
    expect(screen.getByRole("button", { name: "戦術変更" })).toBeVisible();
    expect(screen.getByRole("button", { name: "選手交代" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "このまま次セットへ" }));
    expect(onCommand).toHaveBeenCalledOnce();
    expect(onCommand).toHaveBeenCalledWith({ type: "continue" });
  });

  it("disables every decision action while a command is pending", () => {
    const fixture = findDecision("opponent-run");

    render(
      <MatchCommandPanel
        state={fixture.state}
        match={fixture.match}
        pending
        onCommand={vi.fn()}
      />,
    );

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("hides timeout when it has already been used in the current set", () => {
    const fixture = findDecision("opponent-run");
    const match = structuredClone(fixture.match);
    if (!match.runtime) throw new Error("runtime fixture missing");
    match.runtime.timeoutUsedSchoolIds.push(fixture.state.userSchoolId);

    render(
      <MatchCommandPanel
        state={fixture.state}
        match={match}
        pending={false}
        onCommand={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "タイムアウト" })).toBeNull();
    expect(screen.getByRole("button", { name: "戦術変更" })).toBeVisible();
  });

  it("drafts all three tactics from the authoritative match plan and emits only on submit", () => {
    const fixture = findDecision("set-break");
    const onCommand = vi.fn();
    const runtime = fixture.match.runtime;
    if (!runtime) throw new Error("runtime fixture missing");
    const currentPlan =
      fixture.match.homeSchoolId === fixture.state.userSchoolId
        ? runtime.homeTactics
        : runtime.awayTactics;
    const persistentTactics = JSON.stringify(
      fixture.state.schools[fixture.state.userSchoolId]!.tactics,
    );

    render(
      <MatchCommandPanel
        state={fixture.state}
        match={fixture.match}
        pending={false}
        onCommand={onCommand}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "戦術変更" }));
    const dialog = screen.getByRole("dialog", { name: "戦術変更" });
    const serveGroup = within(dialog).getByRole("group", {
      name: "サーブ方針",
    });
    const attackGroup = within(dialog).getByRole("group", { name: "攻撃方針" });
    const blockGroup = within(dialog).getByRole("group", {
      name: "ブロック方針",
    });

    expect(
      within(serveGroup).getByRole("button", {
        name: tacticOptionLabel("serve", currentPlan.serve),
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(attackGroup).getByRole("button", {
        name: tacticOptionLabel("attack", currentPlan.attack),
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(blockGroup).getByRole("button", {
        name: tacticOptionLabel("block", currentPlan.block),
      }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(serveGroup).getByRole("button", { name: "強気" }));
    fireEvent.click(within(attackGroup).getByRole("button", { name: "高速" }));
    fireEvent.click(
      within(blockGroup).getByRole("button", { name: "コミット" }),
    );

    expect(
      within(serveGroup).getByRole("button", { name: "強気" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(attackGroup).getByRole("button", { name: "高速" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(blockGroup).getByRole("button", { name: "コミット" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(onCommand).not.toHaveBeenCalled();
    expect(
      JSON.stringify(
        fixture.state.schools[fixture.state.userSchoolId]!.tactics,
      ),
    ).toBe(persistentTactics);

    fireEvent.click(
      within(dialog).getByRole("button", { name: "この戦術で続ける" }),
    );
    expect(onCommand).toHaveBeenCalledOnce();
    expect(onCommand).toHaveBeenCalledWith({
      type: "set-match-tactics",
      plan: { serve: "aggressive", attack: "quick", block: "commit" },
    });
  });

  it("selects one current court player then one current bench player and emits one substitution command", () => {
    const fixture = findDecision("set-break");
    const onCommand = vi.fn();
    const selection =
      fixture.match.homeSchoolId === fixture.state.userSchoolId
        ? fixture.match.homeSelection
        : fixture.match.awaySelection;
    const outgoingPlayerId = selection.rotation[0]!.playerId;
    const incomingPlayerId = selection.benchPlayerIds[0]!;

    render(
      <MatchCommandPanel
        state={fixture.state}
        match={fixture.match}
        pending={false}
        onCommand={onCommand}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "選手交代" }));
    const dialog = screen.getByRole("dialog", { name: "選手交代" });
    const courtGroup = within(dialog).getByRole("group", {
      name: "コートの選手",
    });
    expect(within(courtGroup).getAllByRole("button")).toHaveLength(6);

    for (const assignment of selection.rotation) {
      const player = fixture.state.players[assignment.playerId]!;
      const row = within(courtGroup).getByRole("button", {
        name: playerName(fixture.state, player.id),
      });
      expect(within(row).getByText(player.preferredPosition)).toBeVisible();
      expect(
        within(row).getByText(
          getPlayerConditionPresentation(player.condition).label,
        ),
      ).toBeVisible();
      expect(
        within(row).getByText(
          ratingToGrade(Math.round(calculatePlayerDisplayPower(player) / 100)),
        ),
      ).toBeVisible();
    }

    fireEvent.click(
      within(courtGroup).getByRole("button", {
        name: playerName(fixture.state, outgoingPlayerId),
      }),
    );
    expect(onCommand).not.toHaveBeenCalled();

    const benchGroup = within(dialog).getByRole("group", { name: "ベンチ" });
    expect(within(benchGroup).getAllByRole("button")).toHaveLength(
      selection.benchPlayerIds.length,
    );
    for (const playerId of selection.benchPlayerIds) {
      expect(
        within(benchGroup).getByRole("button", {
          name: playerName(fixture.state, playerId),
        }),
      ).toBeVisible();
    }

    fireEvent.click(
      within(benchGroup).getByRole("button", {
        name: playerName(fixture.state, incomingPlayerId),
      }),
    );
    expect(onCommand).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText(
        `${playerName(fixture.state, outgoingPlayerId)} → ${playerName(fixture.state, incomingPlayerId)}`,
      ),
    ).toBeVisible();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "この交代で続ける" }),
    );
    expect(onCommand).toHaveBeenCalledOnce();
    expect(onCommand).toHaveBeenCalledWith({
      type: "substitute",
      outgoingPlayerId,
      incomingPlayerId,
    });
  });
});
