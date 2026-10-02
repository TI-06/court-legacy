import { createDemoGame } from "../../../src/app/createDemoGame";
import {
  decodeGameState,
  encodeGameState,
} from "../../../src/persistence/gameStateCodec";

describe("Phase54 season stats save compatibility", () => {
  it("round-trips optional current-season player stats", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId]!.career.seasonStats = {
      academicYear: state.calendar.academicYear,
      appearances: 4,
      setsPlayed: 9,
      points: 31,
      attackPoints: 20,
      attackAttempts: 37,
      blocks: 4,
      serviceAces: 3,
      receiveAttempts: 12,
      perfectReceives: 8,
      defensePoints: 2,
      idealSets: 1,
      successfulDigs: 5,
    };

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded.players[playerId]!.career.seasonStats).toEqual(
      state.players[playerId]!.career.seasonStats,
    );
  });

  it("accepts current-schema saves that predate season stats", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    delete state.players[playerId]!.career.seasonStats;

    const decoded = decodeGameState(JSON.stringify(state));

    expect(decoded.players[playerId]!.career.seasonStats).toBeUndefined();
  });
});
