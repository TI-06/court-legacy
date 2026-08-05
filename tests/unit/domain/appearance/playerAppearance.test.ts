import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  appearanceSignature,
  assemblePlayerAppearance,
  seedAppearanceSignature,
} from "../../../../src/domain/appearance/playerAppearance";
import type { Player } from "../../../../src/domain/model/Player";

function withChanges(player: Player, changes: Partial<Player>): Player {
  return { ...player, ...changes };
}

describe("player appearance assembly", () => {
  it("is deterministic for the same appearance seed", () => {
    const state = createDemoGame();
    const player =
      state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;

    expect(assemblePlayerAppearance(player)).toEqual(
      assemblePlayerAppearance({ ...player }),
    );
  });

  it("derives the same identity catalog values from the seed alone", () => {
    const state = createDemoGame();
    const player =
      state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;
    const appearance = assemblePlayerAppearance(player);

    expect(seedAppearanceSignature(player.appearanceSeed)).toBe(
      [
        appearance.faceShape,
        appearance.eyeStyle,
        appearance.browStyle,
        appearance.mouthStyle,
        appearance.frontHairStyle,
        appearance.backHairStyle,
        appearance.hairColor,
        appearance.skinTone,
        appearance.accessory,
        appearance.uniformPattern,
      ].join("|"),
    );
  });

  it("exposes the Issue 29 minimum modular catalog sizes", () => {
    const state = createDemoGame();
    const player =
      state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;
    const appearances = Array.from({ length: 2048 }, (_, appearanceSeed) =>
      assemblePlayerAppearance({ ...player, appearanceSeed }),
    );

    expect(
      new Set(appearances.map((item) => item.faceShape)).size,
    ).toBeGreaterThanOrEqual(4);
    expect(
      new Set(appearances.map((item) => item.frontHairStyle)).size,
    ).toBeGreaterThanOrEqual(8);
    expect(
      new Set(appearances.map((item) => item.backHairStyle)).size,
    ).toBeGreaterThanOrEqual(6);
    expect(
      new Set(appearances.map((item) => item.eyeStyle)).size,
    ).toBeGreaterThanOrEqual(6);
    expect(
      new Set(appearances.map((item) => item.browStyle)).size,
    ).toBeGreaterThanOrEqual(5);
    expect(
      new Set(appearances.map((item) => item.mouthStyle)).size,
    ).toBeGreaterThanOrEqual(5);
    expect(
      new Set(appearances.map((item) => item.skinTone)).size,
    ).toBeGreaterThanOrEqual(4);
    expect(
      new Set(appearances.map((item) => item.pose)).size,
    ).toBeGreaterThanOrEqual(4);
  });

  it("keeps identity stable while state changes only alter the expression", () => {
    const state = createDemoGame();
    const player =
      state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;
    const healthy = assemblePlayerAppearance(
      withChanges(player, {
        fatigue: 10,
        morale: 90,
        condition: 90,
        injury: null,
      }),
    );
    const injured = assemblePlayerAppearance(
      withChanges(player, {
        fatigue: 90,
        morale: 90,
        injury: {
          injuryId: "test-injury",
          severity: "moderate",
          remainingWeeks: 4,
          recurrenceRisk: 20,
        },
      }),
    );

    expect(appearanceSignature(healthy)).toBe(appearanceSignature(injured));
    expect(healthy.expression).toBe("confident");
    expect(injured.expression).toBe("pained");
  });

  it("reflects height bands and body types in the descriptor", () => {
    const state = createDemoGame();
    const base =
      state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;

    expect(
      assemblePlayerAppearance(
        withChanges(base, { heightCm: 168, bodyType: "slim" }),
      ),
    ).toMatchObject({ heightBand: "compact", bodyType: "slim" });
    expect(
      assemblePlayerAppearance(
        withChanges(base, { heightCm: 201, bodyType: "large" }),
      ),
    ).toMatchObject({ heightBand: "towering", bodyType: "large" });
  });

  it("gives an initial squad visually distinct core identities", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const signatures = school.playerIds.map((playerId) =>
      appearanceSignature(assemblePlayerAppearance(state.players[playerId]!)),
    );

    expect(new Set(signatures).size).toBeGreaterThanOrEqual(
      school.playerIds.length - 1,
    );
  });
});
