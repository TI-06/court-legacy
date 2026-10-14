import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { Player } from "../../../../src/domain/model/Player";
import {
  getScoringSpecialAbilityId,
} from "../../../../src/domain/player/scoringSpecialAbility";

const normal = {
  ownScore: 10,
  opponentScore: 11,
  setNumber: 1,
  bestOfSets: 3 as const,
};
const critical = { ...normal, ownScore: 23, opponentScore: 22 };

function equipped(...ids: string[]): Player {
  const state = createDemoGame();
  const player = state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;
  return {
    ...player,
    abilities: {
      ...player.abilities,
      spike: 60,
      serve: 60,
      jump: 60,
      decision: 60,
      mental: 60,
    },
    specialAbilityIds: ids,
  };
}

describe("Phase60-4 authoritative scoring skill selection", () => {
  it("only reports an actual positive scoring contribution", () => {
    const player = equipped("attack_course", "serve_stable");
    expect(getScoringSpecialAbilityId(player, "attack", normal)).toBe(
      "attack_course",
    );
    expect(getScoringSpecialAbilityId(player, "serve", normal)).toBe(
      "serve_stable",
    );
    expect(getScoringSpecialAbilityId(player, "block", normal)).toBeNull();
  });

  it("does not trigger clutch abilities before a critical score", () => {
    const player = equipped("attack_clutch");
    expect(getScoringSpecialAbilityId(player, "attack", normal)).toBeNull();
    expect(getScoringSpecialAbilityId(player, "attack", critical)).toBe(
      "attack_clutch",
    );
  });

  it("does not label negative or capped-out abilities as positive activation", () => {
    const negative = equipped("attack_low_finish", "serve_unstable");
    expect(getScoringSpecialAbilityId(negative, "attack", normal)).toBeNull();
    expect(getScoringSpecialAbilityId(negative, "serve", normal)).toBeNull();

    const capped = equipped("attack_course");
    capped.abilities.spike = 100;
    capped.abilities.decision = 100;
    expect(getScoringSpecialAbilityId(capped, "attack", normal)).toBeNull();
  });

  it("prioritizes strong, genuinely contributing rarity and direct serve modifiers", () => {
    const player = equipped(
      "serve_aim",
      "elite_service_ace",
      "gold_serve_king",
    );
    expect(getScoringSpecialAbilityId(player, "serve", normal)).toBe(
      "gold_serve_king",
    );
    player.abilities.serve = 100;
    player.abilities.mental = 100;
    player.abilities.decision = 100;
    expect(getScoringSpecialAbilityId(player, "serve", normal)).toBe(
      "gold_serve_king",
    );
  });

  it("does not consume random state or change the player's owned abilities", () => {
    const player = equipped("gold_absolute_ace");
    const before = JSON.stringify(player);
    expect(getScoringSpecialAbilityId(player, "attack", normal)).toBe(
      "gold_absolute_ace",
    );
    expect(JSON.stringify(player)).toBe(before);
  });
});
