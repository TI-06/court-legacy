import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { HistoricalMatchSummary } from "../../../../src/domain/model/GameState";
import {
  matchId,
  type GameDate,
} from "../../../../src/domain/model/identifiers";
import { rivalryKey } from "../../../../src/domain/world/rivalWorldProgression";
import { SchoolScreen } from "../../../../src/features/school/SchoolScreen";

function appendResult(
  state: ReturnType<typeof createDemoGame>,
  opponentSchoolId: HistoricalMatchSummary["awaySchoolId"],
  index: number,
  userWon: boolean,
  official = false,
) {
  state.history.matches.push({
    matchId: matchId(`legacy-${index}`),
    date: `2026-${String(index + 4).padStart(2, "0")}-01` as GameDate,
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponentSchoolId,
    winnerSchoolId: userWon ? state.userSchoolId : opponentSchoolId,
    homeSetsWon: userWon ? 2 : 1,
    awaySetsWon: userWon ? 1 : 2,
    tournamentId: official ? `official:legacy-${index}` : null,
  });
}

describe("SchoolLegacyPanel", () => {
  it("shows lifetime rivalry records inside the existing records tab", () => {
    const state = createDemoGame();
    const rival = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;

    appendResult(state, rival.id, 0, true, true);
    appendResult(state, rival.id, 1, false);
    appendResult(state, rival.id, 2, false, true);
    appendResult(state, rival.id, 3, false);
    state.world.destinyRivalSchoolId = rival.id;
    state.world.rivalryScores[rivalryKey(state.userSchoolId, rival.id)] = 82;

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);
    fireEvent.click(screen.getByRole("tab", { name: "記録" }));

    const legacy = screen.getByRole("region", { name: "対戦史" });
    expect(legacy).toBeVisible();
    expect(within(legacy).getByText(rival.shortName)).toBeVisible();
    expect(within(legacy).getByText("通算 1勝3敗")).toBeVisible();
    expect(within(legacy).getByText("3連敗中")).toBeVisible();
    expect(within(legacy).getByText("宿敵")).toBeVisible();
    expect(within(legacy).getByText("天敵")).toBeVisible();
    expect(within(legacy).getByText("雪辱戦")).toBeVisible();
    expect(within(legacy).getByText("記憶に残る試合")).toBeVisible();
  });

  it("does not add another school navigation tab", () => {
    const state = createDemoGame();
    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);

    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: "記録" })).toBeVisible();
    expect(screen.queryByRole("tab", { name: "対戦史" })).not.toBeInTheDocument();
  });
});
