import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  calculatePlayerDisplayPower,
  summarizePlayerAbilities,
} from "../../../../src/domain/selectors/playerPresentation";

describe("player presentation selectors", () => {
  it("calculates a stable display power from all abilities", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;
    const values = Object.values(player.abilities);
    const average =
      values.reduce((sum, value) => sum + value, 0) / values.length;

    expect(calculatePlayerDisplayPower(player)).toBe(Math.round(average) * 100);
  });

  it("summarizes the five visible ability groups", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;
    const attack = Math.round(
      (player.abilities.spike + player.abilities.serve) / 2,
    );
    const defense = Math.round(
      (player.abilities.receive + player.abilities.block) / 2,
    );
    const mental = Math.round(
      (player.abilities.decision + player.abilities.mental) / 2,
    );

    expect(summarizePlayerAbilities(player)).toEqual({
      attack,
      defense,
      jump: player.abilities.jump,
      stamina: player.abilities.stamina,
      mental,
    });
  });
});
