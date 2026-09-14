import { selectResolvedPlayerConcerns } from "../../../../src/domain/dynamics/concernResolution";
import type { TeamDynamicsState } from "../../../../src/domain/dynamics/teamDynamicsTypes";
import { playerId } from "../../../../src/domain/model/identifiers";

type ConcernMap = TeamDynamicsState["playerConcerns"];

describe("selectResolvedPlayerConcerns", () => {
  it("returns only concerns that were present before and absent after", () => {
    const playerA = playerId("player-a");
    const playerB = playerId("player-b");
    const playerC = playerId("player-c");
    const before: ConcernMap = {
      [playerA]: [
        { code: "playing-time", severity: 3 },
        { code: "injury-overuse", severity: 2 },
      ],
      [playerB]: [{ code: "team-slump", severity: 1 }],
    };
    const after: ConcernMap = {
      [playerA]: [{ code: "injury-overuse", severity: 2 }],
      [playerC]: [{ code: "role-mismatch", severity: 1 }],
    };

    expect(selectResolvedPlayerConcerns(before, after)).toEqual([
      { playerId: playerA, code: "playing-time" },
      { playerId: playerB, code: "team-slump" },
    ]);
  });

  it("sorts resolved concerns deterministically by player id then concern code", () => {
    const playerA = playerId("player-a");
    const playerB = playerId("player-b");
    const before: ConcernMap = {
      [playerB]: [
        { code: "team-slump", severity: 1 },
        { code: "playing-time", severity: 2 },
      ],
      [playerA]: [
        { code: "role-mismatch", severity: 1 },
        { code: "injury-overuse", severity: 2 },
      ],
    };

    expect(selectResolvedPlayerConcerns(before, {})).toEqual([
      { playerId: playerA, code: "injury-overuse" },
      { playerId: playerA, code: "role-mismatch" },
      { playerId: playerB, code: "playing-time" },
      { playerId: playerB, code: "team-slump" },
    ]);
  });

  it("does not mutate either concern map", () => {
    const player = playerId("player-a");
    const before: ConcernMap = {
      [player]: [{ code: "playing-time", severity: 3 }],
    };
    const after: ConcernMap = {};
    const beforeSnapshot = structuredClone(before);
    const afterSnapshot = structuredClone(after);

    selectResolvedPlayerConcerns(before, after);

    expect(before).toEqual(beforeSnapshot);
    expect(after).toEqual(afterSnapshot);
  });
});
