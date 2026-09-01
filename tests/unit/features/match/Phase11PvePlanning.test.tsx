import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { advanceOfficialTournamentsThroughWeek } from "../../../../src/domain/tournament/progressOfficialTournaments";
import { TournamentScreen } from "../../../../src/features/tournament/TournamentScreen";

it("keeps a due official match reference-only and directs execution to Home", () => {
  const initial = createDemoGame();
  const state = advanceOfficialTournamentsThroughWeek({
    ...initial,
    calendar: { ...initial.calendar, weekOfYear: 9 },
  });

  render(
    <TournamentScreen
      circuit="interhigh"
      level="prefectural"
      onBack={vi.fn()}
      state={state}
    />,
  );

  expect(screen.queryByRole("button", { name: "公式戦を開始" })).toBeNull();
  expect(
    screen.getByText(/ホームの「次の週へ進む」で試合を実施/),
  ).toBeVisible();
});
