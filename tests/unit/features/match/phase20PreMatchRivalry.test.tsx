import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { matchId } from "../../../../src/domain/model/identifiers";
import { calculateSelectionStrength } from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { rivalryKey } from "../../../../src/domain/world/rivalWorldProgression";
import { PreMatchLineupScreen } from "../../../../src/features/match/PreMatchLineupScreen";

describe("Phase20 pre-match rivalry boundary", () => {
  it("shows meaningful local PVE rivalry context", () => {
    const state = createDemoGame();
    const opponent = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    const userSelection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const opponentSelection = autoSelectTeam({
      state,
      schoolId: opponent.id,
    });
    state.history.matches.push({
      matchId: matchId("phase20-pre-match-loss"),
      date: "2026-05-01",
      homeSchoolId: state.userSchoolId,
      awaySchoolId: opponent.id,
      winnerSchoolId: opponent.id,
      homeSetsWon: 1,
      awaySetsWon: 2,
      tournamentId: "prefectural-final",
    });
    state.world.destinyRivalSchoolId = opponent.id;
    state.world.rivalryScores[rivalryKey(state.userSchoolId, opponent.id)] = 75;

    render(
      <PreMatchLineupScreen
        baseSelection={userSelection}
        mode="pve"
        onCancel={vi.fn()}
        onStart={vi.fn()}
        opponentName={opponent.shortName}
        opponentSelection={opponentSelection}
        opponentStrength={calculateSelectionStrength(state, opponentSelection)}
        pending={false}
        state={state}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "対戦分析" }));
    expect(screen.getByRole("dialog", { name: "対戦分析" })).toBeVisible();

    const context = screen.getByRole("region", { name: "対戦相手との因縁" });
    expect(context).toHaveTextContent("通算 0勝1敗");
    expect(context).toHaveTextContent("前回 敗戦 1-2");
    expect(context).toHaveTextContent("宿敵");
    expect(context).toHaveTextContent("雪辱戦");
  });

  it("does not expose local rivalry history on the normal PvP privacy path", () => {
    const state = createDemoGame();
    const opponent = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    const selection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    state.history.matches.push({
      matchId: matchId("local-history-that-must-not-leak"),
      date: "2026-05-01",
      homeSchoolId: state.userSchoolId,
      awaySchoolId: opponent.id,
      winnerSchoolId: opponent.id,
      homeSetsWon: 0,
      awaySetsWon: 2,
      tournamentId: null,
    });

    render(
      <PreMatchLineupScreen
        baseSelection={selection}
        mode="pvp"
        onCancel={vi.fn()}
        onStart={vi.fn()}
        opponentName="オンライン高校"
        opponentStrength={91}
        pending={false}
        state={state}
      />,
    );

    expect(
      screen.queryByRole("region", { name: "対戦相手との因縁" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/相手選手の詳細能力は非公開/)).toBeVisible();
  });
});
