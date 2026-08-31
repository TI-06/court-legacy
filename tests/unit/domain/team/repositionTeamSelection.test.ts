import type { TeamSelection } from "../../../../src/domain/model/TeamSelection";
import { playerId } from "../../../../src/domain/model/identifiers";
import { repositionTeamSelection } from "../../../../src/domain/team/repositionTeamSelection";

const p1 = playerId("p1");
const p2 = playerId("p2");
const p3 = playerId("p3");
const p4 = playerId("p4");
const p5 = playerId("p5");
const p6 = playerId("p6");
const libero = playerId("libero");
const b1 = playerId("b1");
const b2 = playerId("b2");

function selection(): TeamSelection {
  return {
    rotation: [
      { slot: 1, playerId: p1 },
      { slot: 2, playerId: p2 },
      { slot: 3, playerId: p3 },
      { slot: 4, playerId: p4 },
      { slot: 5, playerId: p5 },
      { slot: 6, playerId: p6 },
    ],
    liberoPlayerId: libero,
    benchPlayerIds: [b1, b2],
    servingOrderPlayerIds: [p1, p2, p3, p4, p5, p6],
    substitutionPolicy: {
      starterLockPlayerIds: [p1, p2],
      allowFatigueBenching: true,
      allowInjuryBenching: true,
      automaticSubstitutions: true,
      automaticSetChanges: true,
    },
  };
}

describe("repositionTeamSelection", () => {
  it("swaps two rotation slots without changing serving order", () => {
    const current = selection();
    const next = repositionTeamSelection({
      selection: current,
      source: { type: "rotation", slot: 1 },
      target: { type: "rotation", slot: 4 },
    });

    expect(next?.rotation.find((item) => item.slot === 1)?.playerId).toBe(p4);
    expect(next?.rotation.find((item) => item.slot === 4)?.playerId).toBe(p1);
    expect(next?.servingOrderPlayerIds).toEqual(current.servingOrderPlayerIds);
    expect(current.rotation.find((item) => item.slot === 1)?.playerId).toBe(p1);
  });

  it("swaps a bench player into rotation and replaces the server id", () => {
    const next = repositionTeamSelection({
      selection: selection(),
      source: { type: "bench", playerId: b1 },
      target: { type: "rotation", slot: 2 },
    });

    expect(next?.rotation.find((item) => item.slot === 2)?.playerId).toBe(b1);
    expect(next?.benchPlayerIds).toEqual([p2, b2]);
    expect(next?.servingOrderPlayerIds).toEqual([p1, b1, p3, p4, p5, p6]);
    expect(next?.substitutionPolicy.starterLockPlayerIds).toEqual([p1]);
  });

  it("moves a rotation player to a targeted bench position", () => {
    const next = repositionTeamSelection({
      selection: selection(),
      source: { type: "rotation", slot: 1 },
      target: { type: "bench", playerId: b2 },
    });

    expect(next?.rotation.find((item) => item.slot === 1)?.playerId).toBe(b2);
    expect(next?.benchPlayerIds).toEqual([b1, p1]);
    expect(next?.servingOrderPlayerIds[0]).toBe(b2);
    expect(next?.substitutionPolicy.starterLockPlayerIds).not.toContain(p1);
  });

  it("reorders bench players without touching active players", () => {
    const next = repositionTeamSelection({
      selection: selection(),
      source: { type: "bench", playerId: b1 },
      target: { type: "bench", playerId: b2 },
    });

    expect(next?.benchPlayerIds).toEqual([b2, b1]);
    expect(next?.rotation.map((item) => item.playerId)).toEqual([
      p1,
      p2,
      p3,
      p4,
      p5,
      p6,
    ]);
  });

  it("swaps bench and libero", () => {
    const next = repositionTeamSelection({
      selection: selection(),
      source: { type: "bench", playerId: b1 },
      target: { type: "libero" },
    });

    expect(next?.liberoPlayerId).toBe(b1);
    expect(next?.benchPlayerIds).toEqual([libero, b2]);
  });

  it("rejects direct rotation and libero moves", () => {
    expect(
      repositionTeamSelection({
        selection: selection(),
        source: { type: "rotation", slot: 1 },
        target: { type: "libero" },
      }),
    ).toBeNull();
  });
});
