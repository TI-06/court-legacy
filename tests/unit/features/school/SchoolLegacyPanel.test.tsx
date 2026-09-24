import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { HistoricalMatchSummary } from "../../../../src/domain/model/GameState";
import {
  matchId,
  type GameDate,
} from "../../../../src/domain/model/identifiers";
import { rivalryKey } from "../../../../src/domain/world/rivalWorldProgression";
import type { SchoolLegacyPresentation } from "../../../../src/features/season/seasonProgressPresentation";
import { SchoolLegacyPanel } from "../../../../src/features/school/SchoolLegacyPanel";
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
    fireEvent.click(screen.getByRole("tab", { name: "歴史" }));

    const legacy = screen.getByRole("region", { name: "対戦史" });
    expect(legacy).toBeVisible();
    const opponentCard = within(legacy).getByTestId("school-legacy-opponent");
    expect(within(opponentCard).getByText(rival.shortName)).toBeVisible();
    expect(within(legacy).getByText("通算 1勝3敗")).toBeVisible();
    expect(within(legacy).getByText("3連敗中")).toBeVisible();
    expect(within(legacy).getByText("宿敵")).toBeVisible();
    expect(within(legacy).getByText("天敵")).toBeVisible();
    expect(within(legacy).getByText("雪辱戦")).toBeVisible();
    expect(within(legacy).getByText("記憶に残る試合")).toBeVisible();
  });

  it("keeps long rivalry history compact and opens the full archive on demand", () => {
    const presentation: SchoolLegacyPresentation = {
      opponents: Array.from({ length: 5 }, (_, index) => ({
        schoolId: `rival-${index}` as never,
        displayName: `ライバル${index + 1}高校`,
        recordLabel: `通算 ${index + 1}勝${index}敗`,
        meetingLabel: `${index + 2}戦・公式1 / 練習${index + 1}`,
        streakLabel: index === 0 ? "3連勝中" : null,
        rivalryScore: 90 - index * 10,
        labels: index === 0 ? ["destiny-rival"] : [],
      })),
      notableMatches: Array.from({ length: 5 }, (_, index) => ({
        matchId: `match-${index}`,
        date: `2026-0${index + 4}-01`,
        opponentName: `ライバル${index + 1}高校`,
        resultLabel: index % 2 === 0 ? "勝利 2-1" : "敗戦 1-2",
        reasons: ["公式戦"],
      })),
    };

    render(<SchoolLegacyPanel presentation={presentation} />);

    const legacy = screen.getByRole("region", { name: "対戦史" });
    expect(within(legacy).getAllByTestId("school-legacy-opponent")).toHaveLength(
      2,
    );
    expect(
      within(legacy).getAllByTestId("school-legacy-notable-match"),
    ).toHaveLength(2);
    expect(
      within(legacy).getByRole("button", { name: "対戦史をすべて見る" }),
    ).toBeVisible();

    fireEvent.click(
      within(legacy).getByRole("button", { name: "対戦史をすべて見る" }),
    );
    const dialog = screen.getByRole("dialog", { name: "対戦史一覧" });
    expect(within(dialog).getAllByTestId("school-legacy-opponent")).toHaveLength(
      5,
    );
    expect(
      within(dialog).getAllByTestId("school-legacy-notable-match"),
    ).toHaveLength(5);
  });

  it("keeps only three primary school navigation tabs", () => {
    const state = createDemoGame();
    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);

    const primaryTabs = screen.getByRole("tablist", {
      name: "学校運営メニュー",
    });
    expect(within(primaryTabs).getAllByRole("tab")).toHaveLength(3);
    expect(
      within(primaryTabs).getByRole("tab", { name: "記録" }),
    ).toBeVisible();
    expect(
      within(primaryTabs).queryByRole("tab", { name: "卒業生" }),
    ).not.toBeInTheDocument();
  });
});
