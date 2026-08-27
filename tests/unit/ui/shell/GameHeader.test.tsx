import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { GameHeader } from "../../../../src/ui/shell/GameHeader";

describe("GameHeader", () => {
  it("keeps school, date, reputation, and cloud save state visible without a manual save button", () => {
    const onOpenCalendar = vi.fn();

    render(
      <GameHeader
        dateLabel="2026年4月1日"
        onOpenCalendar={onOpenCalendar}
        operation={{ status: "success", label: "同期" }}
        reputationLabel="E 無名"
        schoolName="青葉高校"
      />,
    );

    expect(screen.getByText("青葉高校")).toBeVisible();
    expect(screen.getByText("2026年4月1日")).toBeVisible();
    expect(screen.getByText("E 無名")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("保存済み ✓");
    expect(
      screen.queryByRole("button", { name: "セーブ・ロードを開く" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "予定を確認" }));
    expect(onOpenCalendar).toHaveBeenCalledTimes(1);
  });
});
