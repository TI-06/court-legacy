import type { RandomSource } from "../../../../src/domain/random/SeededRandom";
import type { Player } from "../../../../src/domain/model/Player";
import { playerId, schoolId } from "../../../../src/domain/model/identifiers";
import {
  addSpecialAbilityTip,
  removeNegativeSpecialAbility,
  resolveTrainingCampSpecialAbilityProgress,
} from "../../../../src/domain/player/specialAbilityProgression";

class SequenceRandom implements RandomSource {
  #index = 0;

  constructor(private readonly values: readonly number[]) {}

  get cursor(): number {
    return this.#index;
  }

  next(): number {
    const value = this.values[this.#index] ?? 0.99;
    this.#index += 1;
    return value;
  }

  int(minimum: number, maximum: number): number {
    return minimum + Math.floor(this.next() * (maximum - minimum + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)]!;
  }

  fork(): RandomSource {
    return new SequenceRandom(this.values);
  }

  snapshot() {
    return { seed: "sequence", cursor: this.cursor };
  }
}

function createPlayer(): Player {
  return {
    id: playerId("player-special-progress"),
    firstName: "太郎",
    lastName: "青木",
    reading: "あおき たろう",
    grade: 2,
    heightCm: 180,
    bodyType: "standard",
    handedness: "right",
    preferredPosition: "OH",
    positionAptitudes: { OH: 90, MB: 30, OP: 60, S: 25, L: 40 },
    abilities: {
      spike: 60,
      jump: 60,
      receive: 55,
      serve: 55,
      set: 35,
      block: 45,
      speed: 55,
      stamina: 55,
      decision: 50,
      mental: 50,
    },
    condition: 90,
    fatigue: 0,
    morale: 70,
    trust: 50,
    academic: 60,
    personalityId: "personality.balanced",
    growthTypeId: "growth.standard",
    traitIds: [],
    specialAbilityIds: [],
    specialAbilityTipLevels: {},
    hiddenTraitIds: [],
    revealedHiddenTraitIds: [],
    hiddenTraitAssignmentInitialized: true,
    tier: "normal",
    injury: null,
    career: {
      schoolId: schoolId("school-test"),
      enrolledYear: 1,
      appearances: 0,
      setsPlayed: 0,
      points: 0,
      blocks: 0,
      serviceAces: 0,
      captainSeasons: 0,
      awardIds: [],
      bestTournamentResultId: null,
    },
  };
}

// Camp progression uses deterministic random sources so save/retry stays reproducible.
describe("special ability progression", () => {
  it("turns three tip levels into a learned ability", () => {
    const base = createPlayer();
    const first = addSpecialAbilityTip(base, "attack_course");
    const second = addSpecialAbilityTip(first.player, "attack_course");
    const third = addSpecialAbilityTip(second.player, "attack_course");

    expect(first.player.specialAbilityTipLevels?.attack_course).toBe(1);
    expect(second.player.specialAbilityTipLevels?.attack_course).toBe(2);
    expect(third.player.specialAbilityIds).toContain("attack_course");
    expect(third.player.specialAbilityTipLevels?.attack_course).toBeUndefined();
    expect(third.changes).toEqual([
      {
        playerId: base.id,
        abilityId: "attack_course",
        kind: "learned",
      },
    ]);
  });

  it("replaces the opposite red ability on learn", () => {
    const base = createPlayer();
    base.specialAbilityIds = ["serve_unstable"];
    base.specialAbilityTipLevels = { serve_stable: 2 };

    const resolved = addSpecialAbilityTip(base, "serve_stable");

    expect(resolved.player.specialAbilityIds).toContain("serve_stable");
    expect(resolved.player.specialAbilityIds).not.toContain("serve_unstable");
    const tipLevels = resolved.player.specialAbilityTipLevels;
    expect(tipLevels?.serve_stable).toBeUndefined();
  });

  it("removes only the selected negative ability", () => {
    const base = createPlayer();
    base.specialAbilityIds = ["serve_stable", "serve_unstable"];

    const resolved = removeNegativeSpecialAbility(base, "serve_unstable");

    expect(resolved.player.specialAbilityIds).toEqual(["serve_stable"]);
    expect(resolved.changes[0]).toMatchObject({
      abilityId: "serve_unstable",
      kind: "negative-removed",
    });
  });

  it("can award a position-relevant tip during training camp", () => {
    const base = createPlayer();
    const random = new SequenceRandom([0.01, 0.5, 0]);

    const resolved = resolveTrainingCampSpecialAbilityProgress(base, random);

    expect(resolved.changes).toHaveLength(1);
    expect(resolved.changes[0]).toMatchObject({
      kind: "tip",
      tipLevel: 1,
    });
    expect(
      Object.values(resolved.player.specialAbilityTipLevels ?? {}),
    ).toContain(1);
  });

  it("can improve a negative ability during training camp", () => {
    const base = createPlayer();
    base.specialAbilityIds = ["serve_unstable"];
    const random = new SequenceRandom([0.01, 0, 0.99]);

    const resolved = resolveTrainingCampSpecialAbilityProgress(base, random);

    expect(resolved.player.specialAbilityIds).not.toContain("serve_unstable");
    expect(resolved.changes).toEqual([
      {
        playerId: base.id,
        abilityId: "serve_unstable",
        kind: "negative-removed",
      },
    ]);
  });
});
