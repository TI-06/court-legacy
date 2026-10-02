import { fireEvent, render, screen, within } from "@testing-library/react";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PlayerHubScreen } from "../../../../src/features/team/PlayerHubScreen";

describe("Phase54 season leaderboard UI", () => {
  it(
    "opens a compact team leaderboard and drills into the selected player's record",
    () => {
      const state = createDemoGame();
      const ids = state.schools[state.userSchoolId]!.playerIds;
      const first = state.players[ids[0]!]!;
      const second = state.players[ids[1]!]!;

      first.career.seasonStats = {
        academicYear: state.calendar.academicYear,
        appearances: 3,
        setsPlayed: 7,
        points: 24,
        attackPoints: 15,
        attackAttempts: 25,
        blocks: 2,
        serviceAces: 4,
        receiveAttempts: 8,
        perfectReceives: 5,
        defensePoints: 1,
        idealSets: 0,
        successfulDigs: 3,
      };
      second.career.seasonStats = {
        academicYear: state.calendar.academicYear,
        appearances: 3,
        setsPlayed: 8,
        points: 18,
        attackPoints: 10,
        attackAttempts: 12,
        blocks: 5,
        serviceAces: 1,
        receiveAttempts: 10,
        perfectReceives: 8,
        defensePoints: 2,
        idealSets: 0,
        successfulDigs: 5,
      };

      render(
        <PlayerHubScreen
          data={gameData}
          onAssignLeadership={vi.fn()}
          onChange={vi.fn()}
          selection={autoSelectTeam({ state, schoolId: state.userSchoolId })}
          state={state}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "今季の公式戦成績" }),
      );

      const dialog = screen.getByRole("dialog", {
        name: `${state.calendar.academicYear}年度 今季成績`,
      });
      const ranking = within(dialog).getByRole("region", {
        name: "今季公式戦ランキング",
      });
      expect(within(ranking).getByText("得点")).toBeVisible();
      expect(within(ranking).getByText("アタック決定率")).toBeVisible();
      expect(within(ranking).getByText("好レシーブ率")).toBeVisible();
      expect(within(ranking).getAllByText("5回以上で集計")).toHaveLength(2);

      const pointsSection = within(ranking)
        .getByText("得点")
        .closest("section") as HTMLElement;
      expect(
        within(pointsSection).getByText(
          `${first.lastName} ${first.firstName}`,
        ),
      ).toBeVisible();
      expect(within(pointsSection).getByText("24")).toBeVisible();

      fireEvent.click(
        within(pointsSection).getByRole("button", {
          name: new RegExp(`${first.lastName} ${first.firstName}`),
        }),
      );

      expect(
        screen.getByRole("heading", {
          name: `${first.lastName} ${first.firstName}`,
        }),
      ).toBeVisible();
      expect(screen.getByTestId("player-detail-record")).toBeVisible();

      const seasonRecord = screen.getByRole("region", {
        name: "今季公式戦成績",
      });
      expect(within(seasonRecord).getByText("24")).toBeVisible();
      expect(within(seasonRecord).getByText("60%")).toBeVisible();
      expect(within(seasonRecord).getByText("63%")).toBeVisible();
    },
  );

  it("shows an empty-state before the first official match", () => {
    const state = createDemoGame();

    render(
      <PlayerHubScreen
        data={gameData}
        onAssignLeadership={vi.fn()}
        onChange={vi.fn()}
        selection={autoSelectTeam({ state, schoolId: state.userSchoolId })}
        state={state}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "今季の公式戦成績" }),
    );

    expect(
      screen.getByText("今季の公式戦成績はまだありません"),
    ).toBeVisible();
  });
});
