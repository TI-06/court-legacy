import { fireEvent, render, screen, within } from "@testing-library/react";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { buildSeasonProgressPresentation } from "../../../../src/features/season/seasonProgressPresentation";
import { SchoolSeasonRanking } from "../../../../src/features/school/SchoolSeasonRanking";

describe("compact school season ranking", () => {
  it("keeps goals and rank summaries on the main surface and opens nearby schools on demand", () => {
    const presentation = buildSeasonProgressPresentation(createDemoGame())!;

    render(<SchoolSeasonRanking presentation={presentation} />);

    const dashboard = screen.getByRole("region", { name: "今季ランキング" });
    expect(within(dashboard).getAllByTestId("school-season-goal")).toHaveLength(
      presentation.goals.length,
    );
    expect(
      within(dashboard).getByRole("button", { name: "県内周辺校を見る" }),
    ).toBeVisible();
    expect(
      within(dashboard).getByRole("button", { name: "全国周辺校を見る" }),
    ).toBeVisible();
    expect(
      within(dashboard).queryByTestId("school-ranking-user-row"),
    ).toBeNull();

    fireEvent.click(
      within(dashboard).getByRole("button", { name: "県内周辺校を見る" }),
    );
    let dialog = screen.getByRole("dialog", { name: "県内ランキング" });
    expect(within(dialog).getByTestId("school-ranking-user-row")).toBeVisible();
    expect(within(dialog).getAllByTestId(/school-ranking-/)).toHaveLength(
      presentation.regional.nearby.length,
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));
    fireEvent.click(
      within(dashboard).getByRole("button", { name: "全国周辺校を見る" }),
    );
    dialog = screen.getByRole("dialog", { name: "全国ランキング" });
    expect(within(dialog).getByTestId("school-ranking-user-row")).toBeVisible();
  });
});
