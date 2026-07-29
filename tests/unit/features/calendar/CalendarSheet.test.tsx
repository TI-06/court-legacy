import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { CalendarSheet } from "../../../../src/features/calendar/CalendarSheet";

function createState() {
  return createDemoGame();
}

describe("weekly calendar sheet", () => {
  it("shows the current week and disables progression before training", () => {
    const state = createState();

    render(
      <CalendarSheet
        onAdvanceWeek={vi.fn()}
        onClose={vi.fn()}
        open
        practiceMatchCompleted
        state={state}
        trainingCompleted={false}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "週間カレンダー" }),
    ).toBeVisible();
    expect(screen.getByText("2026年4月1日")).toBeVisible();
    expect(screen.getByText("学年度 1")).toBeVisible();
    expect(screen.getByText("第1週")).toBeVisible();
    expect(screen.getByText("練習 未実施")).toBeVisible();
    expect(screen.getByText("練習試合 完了")).toBeVisible();
    expect(screen.getByRole("button", { name: "次の週へ進む" })).toBeDisabled();
    expect(screen.getByText("練習を完了すると進めます")).toBeVisible();
  });

  it("uses the shared callback when advancing after training", () => {
    const state = createState();
    const onAdvanceWeek = vi.fn();

    render(
      <CalendarSheet
        onAdvanceWeek={onAdvanceWeek}
        onClose={vi.fn()}
        open
        practiceMatchCompleted={false}
        state={state}
        trainingCompleted
      />,
    );

    const button = screen.getByRole("button", { name: "次の週へ進む" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onAdvanceWeek).toHaveBeenCalledOnce();
  });

  it("sorts future activities and shows Japanese activity labels", () => {
    const state = createState();
    state.calendar.activities = [
      {
        id: "past",
        date: "2026-03-25",
        type: "practice",
        title: "過去の練習",
        mandatory: false,
        matchId: null,
        metadata: {},
      },
      {
        id: "exam",
        date: "2026-04-15",
        type: "exam",
        title: "中間試験",
        mandatory: true,
        matchId: null,
        metadata: {},
      },
      {
        id: "match",
        date: "2026-04-08",
        type: "practice-match",
        title: "合同練習試合",
        mandatory: false,
        matchId: null,
        metadata: {},
      },
      {
        id: "national",
        date: "2026-05-01",
        type: "national-tournament",
        title: "全国大会",
        mandatory: true,
        matchId: null,
        metadata: {},
      },
    ];

    render(
      <CalendarSheet
        onAdvanceWeek={vi.fn()}
        onClose={vi.fn()}
        open
        practiceMatchCompleted={false}
        state={state}
        trainingCompleted={false}
      />,
    );

    const activities = screen.getAllByTestId("calendar-activity");
    expect(activities).toHaveLength(3);
    expect(activities[0]).toHaveTextContent("2026年4月8日");
    expect(activities[0]).toHaveTextContent("練習試合");
    expect(activities[1]).toHaveTextContent("定期試験");
    expect(activities[2]).toHaveTextContent("全国大会");
    expect(screen.queryByText("過去の練習")).not.toBeInTheDocument();
  });

  it("shows four weekly guide dates and an empty official schedule", () => {
    const state = createState();

    render(
      <CalendarSheet
        onAdvanceWeek={vi.fn()}
        onClose={vi.fn()}
        open
        practiceMatchCompleted={false}
        state={state}
        trainingCompleted={false}
      />,
    );

    expect(screen.getByText("登録された公式予定はありません")).toBeVisible();
    expect(
      screen.getByText("2026年4月1日", { selector: "time" }),
    ).toBeVisible();
    expect(
      screen.getByText("2026年4月8日", { selector: "time" }),
    ).toBeVisible();
    expect(
      screen.getByText("2026年4月15日", { selector: "time" }),
    ).toBeVisible();
    expect(
      screen.getByText("2026年4月22日", { selector: "time" }),
    ).toBeVisible();
  });

  it("does not render when closed", () => {
    render(
      <CalendarSheet
        onAdvanceWeek={vi.fn()}
        onClose={vi.fn()}
        open={false}
        practiceMatchCompleted={false}
        state={createState()}
        trainingCompleted={false}
      />,
    );

    expect(
      screen.queryByRole("dialog", { name: "週間カレンダー" }),
    ).not.toBeInTheDocument();
  });
});
