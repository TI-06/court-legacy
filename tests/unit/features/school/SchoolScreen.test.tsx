import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  matchId,
  type GameDate,
} from "../../../../src/domain/model/identifiers";
import { rivalryKey } from "../../../../src/domain/world/rivalWorldProgression";
import { SchoolScreen } from "../../../../src/features/school/SchoolScreen";

function createState() {
  return createDemoGame();
}

describe("school management screen", () => {
  it("shows school status with Japanese headings and confirms a facility upgrade", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    const onUpgradeFacility = vi.fn();

    render(
      <SchoolScreen onUpgradeFacility={onUpgradeFacility} state={state} />,
    );

    expect(screen.getByRole("heading", { name: school.name })).toBeVisible();
    expect(screen.getByText("学校運営")).toBeVisible();
    expect(screen.getByText("施設")).toBeVisible();
    expect(screen.queryByText("SCHOOL MANAGEMENT")).toBeNull();
    expect(screen.queryByText("FACILITIES")).toBeNull();
    expect(screen.getByText(/無名校/)).toBeVisible();
    expect(screen.getByText("資金 300")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "トレーニング設備を強化" }),
    );

    const dialog = screen.getByRole("dialog", { name: "設備を強化" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByText("Lv.0 → Lv.1")).toBeVisible();
    expect(within(dialog).getByText("強化後の資金")).toBeVisible();
    expect(within(dialog).getByText("230")).toBeVisible();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "70を使って強化" }),
    );
    expect(onUpgradeFacility).toHaveBeenCalledWith("trainingRoom");
  });

  it("disables upgrades when funds are insufficient or the facility is maxed", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    state.schools[state.userSchoolId] = {
      ...school,
      funds: 10,
      facilities: {
        ...school.facilities,
        gym: 5,
      },
    };

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);

    expect(
      screen.getByRole("button", { name: "体育館は最大レベル" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "トレーニング設備は資金不足" }),
    ).toBeDisabled();
    expect(screen.getByText("あと60必要")).toBeVisible();
  });

  it("shows the destiny rival and current rivalry score", () => {
    const state = createState();
    const rival = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    state.world.destinyRivalSchoolId = rival.id;
    state.world.rivalryScores[rivalryKey(state.userSchoolId, rival.id)] = 73;

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);

    expect(screen.getByText("宿命校")).toBeVisible();
    expect(screen.getByText(`${rival.name}・因縁 73`)).toBeVisible();
  });

  it("shows the five most recent school matches in date order with Japanese labels", () => {
    const state = createState();
    const rivals = Object.values(state.schools).filter(
      (school) => school.id !== state.userSchoolId,
    );
    state.history.matches = Array.from({ length: 6 }, (_, index) => ({
      matchId: matchId(`school-record-${index}`),
      date: `2026-04-${String(index + 1).padStart(2, "0")}` as GameDate,
      homeSchoolId: state.userSchoolId,
      awaySchoolId: rivals[index]!.id,
      winnerSchoolId: index % 2 === 0 ? state.userSchoolId : rivals[index]!.id,
      homeSetsWon: index % 2 === 0 ? 2 : 1,
      awaySetsWon: index % 2 === 0 ? 0 : 2,
      tournamentId: null,
    }));

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);
    fireEvent.click(screen.getByRole("tab", { name: "記録" }));

    expect(screen.getByText("戦績")).toBeVisible();
    expect(screen.queryByText("SCHOOL RECORDS")).toBeNull();
    const rows = screen.getAllByTestId("school-match-record");
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent("2026年4月6日");
    expect(rows[0]).toHaveTextContent(rivals[5]!.name);
    expect(screen.queryByText(rivals[0]!.name)).not.toBeInTheDocument();
  });

  it("shows a Japanese graduate tab, empty state, and graduate record", () => {
    const state = createState();
    const player =
      state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;

    const { rerender } = render(
      <SchoolScreen onUpgradeFacility={vi.fn()} state={state} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "卒業生" }));
    expect(screen.getByText("卒業生")).toBeVisible();
    expect(screen.queryByText("ALUMNI")).toBeNull();
    expect(screen.getByText("卒業生の記録はまだありません")).toBeVisible();

    const withGraduate = {
      ...state,
      history: {
        ...state.history,
        graduates: [
          {
            playerId: player.id,
            schoolId: state.userSchoolId,
            graduationYear: 2026,
            displayName: `${player.lastName} ${player.firstName}`,
            position: player.preferredPosition,
            appearances: 18,
            points: 210,
            blocks: 35,
            serviceAces: 22,
            awardIds: [],
          },
        ],
      },
    };

    rerender(<SchoolScreen onUpgradeFacility={vi.fn()} state={withGraduate} />);
    expect(
      screen.getByText(`${player.lastName} ${player.firstName}`),
    ).toBeVisible();
    expect(screen.getByText("出場 18")).toBeVisible();
    expect(screen.getByText("得点 210")).toBeVisible();
  });
});
