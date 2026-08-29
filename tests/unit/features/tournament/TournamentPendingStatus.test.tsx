import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { advanceOfficialTournamentsThroughWeek } from "../../../../src/domain/tournament/progressOfficialTournaments";
import { TournamentScreen } from "../../../../src/features/tournament/TournamentScreen";

describe("TournamentScreen official match progress", () => {
  it("keeps every authoritative processing stage visibly labeled", () => {
    const initial = createDemoGame();
    const state = advanceOfficialTournamentsThroughWeek({
      ...initial,
      calendar: {
        ...initial.calendar,
        weekOfYear: 9,
      },
    });

    render(
      <TournamentScreen
        circuit="interhigh"
        level="prefectural"
        onBack={vi.fn()}
        onStartOfficialMatch={vi.fn()}
        pending
        state={state}
        trainingCompleted
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("公式戦を開始しています…");
    expect(status).toHaveTextContent("試合結果を確定しています…");
    expect(status).toHaveTextContent("大会結果を保存しています…");
  });
});
