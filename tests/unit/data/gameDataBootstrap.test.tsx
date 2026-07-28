import { render, screen } from "@testing-library/react";
import { GameDataErrorScreen } from "../../../src/app/GameDataErrorScreen";
import {
  bootstrapGameData,
  type GameDataBootstrapResult,
} from "../../../src/data/gameData";
import { rawGameData } from "../../../src/data/rawGameData";

describe("game data bootstrap", () => {
  it("returns a usable registry for the built-in catalog", () => {
    const result = bootstrapGameData(rawGameData);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.traits.size).toBeGreaterThanOrEqual(50);
    }
  });

  it("returns a diagnostic result instead of partially loaded data", () => {
    const invalid = structuredClone(rawGameData);
    invalid.events[0].choices[0].followUp = {
      eventId: "event.missing",
      afterWeeks: 1,
      probability: 100,
    };

    const result = bootstrapGameData(invalid);

    expect(result).toEqual({
      ok: false,
      message:
        "event event.first-position-request references unknown follow-up: event.missing",
    } satisfies GameDataBootstrapResult);
  });

  it("shows a development diagnostic without exposing a stack trace", () => {
    render(<GameDataErrorScreen message="traits[2] is invalid" />);

    expect(
      screen.getByRole("heading", {
        name: "ゲームデータを読み込めません",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("traits[2] is invalid")).toBeInTheDocument();
    expect(screen.queryByText(/at loadGameData/)).not.toBeInTheDocument();
  });
});
