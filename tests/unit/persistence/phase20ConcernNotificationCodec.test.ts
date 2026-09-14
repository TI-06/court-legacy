import { createDemoGame } from "../../../src/app/createDemoGame";
import type { GameDate } from "../../../src/domain/model/identifiers";
import {
  decodeGameState,
  encodeGameState,
} from "../../../src/persistence/gameStateCodec";

describe("Phase20 concern notification codec", () => {
  it("round-trips a concern-resolution notification in schema v8", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    state.notifications.items = [
      {
        id: "concern-resolution:official-test",
        type: "concern-resolution",
        createdGameDate: "2026-04-15" as GameDate,
        academicYearIndex: state.yearIndex,
        weekOfYear: state.calendar.weekOfYear,
        readAtGameDate: null,
        payload: {
          items: [
            {
              playerId,
              displayName: `${player.lastName} ${player.firstName}`,
              concernCode: "playing-time",
              concernTitle: "出場機会への不満",
            },
          ],
        },
      },
    ];

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded.schemaVersion).toBe(8);
    expect(decoded.notifications).toEqual(state.notifications);
  });

  it("still round-trips a schema v8 state with training notifications only", () => {
    const state = createDemoGame();
    state.notifications.items = [
      {
        id: "training-result:legacy-v8",
        type: "training-result",
        createdGameDate: state.date,
        academicYearIndex: state.yearIndex,
        weekOfYear: state.calendar.weekOfYear,
        readAtGameDate: null,
        payload: {
          teamTrainingMenuName: "基礎練習",
          totalAbilityGrowth: 0,
          totalFatigueChange: 0,
          injuredCount: 0,
          players: [],
        },
      },
    ];

    expect(decodeGameState(encodeGameState(state)).notifications).toEqual(
      state.notifications,
    );
  });
});
