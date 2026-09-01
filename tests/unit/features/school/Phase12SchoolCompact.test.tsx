import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../../../../src/App";
import { FACILITY_DEFINITIONS } from "../../../../src/domain/school/facilityUpgrade";

describe("Phase 12 compact school management", () => {
  it("uses School as a direct destination with scouting beside facilities", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "学校" }));

    expect(screen.getByRole("heading", { name: "設備を強化" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "スカウト" })).toBeVisible();
  });

  it("shows facilities as compact tiles and moves descriptions into the detail sheet", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "学校" }));

    const tiles = screen.getAllByTestId("facility-tile");
    expect(tiles).toHaveLength(FACILITY_DEFINITIONS.length);

    const first = FACILITY_DEFINITIONS[0]!;
    expect(screen.queryByText(first.description)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: first.name + "の詳細" }));
    const dialog = screen.getByRole("dialog", { name: "設備を強化" });
    expect(within(dialog).getByText(first.description)).toBeVisible();
    expect(within(dialog).getByText(/Lv\./)).toBeVisible();
  });
});
