import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { vi } from "vitest";
import type {
  PvpChallengeResponse,
  PvpHistoryEntry,
  PvpOpponentSummary,
  PvpPublishedTeamSummary,
  PvpRankingEntry,
} from "../../../../src/domain/pvp/pvpContracts";
import { PvpScreen } from "../../../../src/features/pvp/PvpScreen";

const publishedTeam: PvpPublishedTeamSummary = {
  snapshotId: "00000000-0000-4000-8000-000000000101",
  schoolName: "青葉高校",
  schoolShortName: "青葉",
  reputationRank: "B",
  teamPower: 71,
  academicYear: 2026,
  publishedAt: "2026-08-28T07:00:00.000Z",
};

const opponent: PvpOpponentSummary = {
  snapshotId: "00000000-0000-4000-8000-000000000201",
  schoolName: "白波高校",
  schoolShortName: "白波",
  reputationRank: "A",
  teamPower: 76,
  academicYear: 2026,
  publishedAt: "2026-08-28T07:05:00.000Z",
  rating: 1048,
  wins: 12,
  losses: 7,
  currentWinStreak: 3,
};

const ranking: PvpRankingEntry = {
  rank: 4,
  snapshotId: opponent.snapshotId,
  schoolName: opponent.schoolName,
  schoolShortName: opponent.schoolShortName,
  rating: 1048,
  matches: 19,
  wins: 12,
  losses: 7,
  currentWinStreak: 3,
};

const history: PvpHistoryEntry = {
  matchId: "00000000-0000-4000-8000-000000000301",
  createdAt: "2026-08-28T07:10:00.000Z",
  opponentSnapshotId: opponent.snapshotId,
  opponentSchoolName: opponent.schoolName,
  perspective: "challenger",
  outcome: "win",
  ratingBefore: 1000,
  ratingAfter: 1016,
  result: {
    outcome: "win",
    challengerSetsWon: 2,
    defenderSetsWon: 1,
    sets: [
      { setNumber: 1, challengerScore: 25, defenderScore: 20 },
      { setNumber: 2, challengerScore: 22, defenderScore: 25 },
      { setNumber: 3, challengerScore: 25, defenderScore: 18 },
    ],
  },
};

const result: PvpChallengeResponse = {
  operationId: "challenge-1",
  revision: 9,
  seasonId: "2026-08",
  matchId: history.matchId,
  opponent: {
    snapshotId: opponent.snapshotId,
    schoolName: opponent.schoolName,
    schoolShortName: opponent.schoolShortName,
  },
  rating: { before: 1000, after: 1016, delta: 16 },
  result: history.result,
  createdAt: history.createdAt,
};

function renderScreen(
  overrides: Partial<ComponentProps<typeof PvpScreen>> = {},
) {
  const props: ComponentProps<typeof PvpScreen> = {
    publishedTeam,
    seasonId: "2026-08",
    opponents: [opponent],
    ranking: [ranking],
    history: [history],
    result,
    loading: false,
    publishing: false,
    challengingSnapshotId: null,
    error: null,
    onPublish: vi.fn(),
    onRefresh: vi.fn(),
    onChallenge: vi.fn(),
    onReturnPractice: vi.fn(),
    ...overrides,
  };
  render(<PvpScreen {...props} />);
  return props;
}

describe("PvpScreen", () => {
  it("renders public status, opponents, result, ranking, and history", () => {
    renderScreen();

    expect(screen.getByRole("heading", { name: "対人戦" })).toBeVisible();
    expect(screen.getByText("公開中")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "対戦する 白波高校" }),
    ).toBeVisible();
    expect(screen.getByText("RATING 1048")).toBeVisible();
    expect(screen.getByText("12勝 7敗")).toBeVisible();
    expect(screen.getByText("勝利")).toBeVisible();
    expect(screen.getAllByText("+16")).toHaveLength(2);
    expect(screen.getByText("4位")).toBeVisible();
    expect(screen.getByLabelText("セット結果")).toHaveTextContent(
      /SET 1\s+25\s*-\s*20/,
    );
  });

  it("renders defender history with the viewer score first", () => {
    const defenderHistory: PvpHistoryEntry = {
      ...history,
      matchId: "00000000-0000-4000-8000-000000000302",
      opponentSnapshotId: null,
      opponentSchoolName: "青葉高校",
      perspective: "defender",
      outcome: "win",
      ratingBefore: 1000,
      ratingAfter: 1016,
      result: {
        ...history.result,
        outcome: "loss",
        challengerSetsWon: 1,
        defenderSetsWon: 2,
      },
    };

    renderScreen({ history: [defenderHistory], result: null });

    expect(screen.getByText("青葉高校")).toBeVisible();
    expect(screen.getByText("2 - 1")).toBeVisible();
    expect(screen.getByText("+16")).toBeVisible();
  });

  it("keeps visible progress while loading instead of showing a blank screen", () => {
    renderScreen({ loading: true, opponents: [], ranking: [], history: [] });

    expect(screen.getByRole("heading", { name: "対人戦" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "対人戦データを読み込んでいます…",
    );
  });

  it("shows immediate pending states for publish and challenge actions", () => {
    const { rerender } = render(
      <PvpScreen
        challengingSnapshotId={null}
        error={null}
        history={[]}
        loading={false}
        onChallenge={vi.fn()}
        onPublish={vi.fn()}
        onRefresh={vi.fn()}
        onReturnPractice={vi.fn()}
        opponents={[opponent]}
        publishedTeam={null}
        publishing
        ranking={[]}
        result={null}
        seasonId="2026-08"
      />,
    );

    expect(
      screen.getByRole("button", { name: "チーム公開中…" }),
    ).toBeDisabled();

    rerender(
      <PvpScreen
        challengingSnapshotId={opponent.snapshotId}
        error={null}
        history={[]}
        loading={false}
        onChallenge={vi.fn()}
        onPublish={vi.fn()}
        onRefresh={vi.fn()}
        onReturnPractice={vi.fn()}
        opponents={[opponent]}
        publishedTeam={publishedTeam}
        publishing={false}
        ranking={[]}
        result={null}
        seasonId="2026-08"
      />,
    );

    expect(
      screen.getByRole("button", { name: "対戦中… 白波高校" }),
    ).toBeDisabled();
  });

  it("shows retryable errors", () => {
    const onRefresh = vi.fn();
    renderScreen({ error: "対人戦データを読み込めませんでした", onRefresh });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "対人戦データを読み込めませんでした",
    );
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
