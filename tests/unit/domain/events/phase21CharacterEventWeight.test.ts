import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import { characterEventWeightMultiplier } from "../../../../src/domain/events/characterEventWeight";
import type {
  CharacterTraitDefinition,
  EventDefinition,
  PersonalityDefinition,
} from "../../../../src/domain/validation/gameDataSchema";

const personalityId = "personality.phase21-weight";
const traitId = "character.phase21-weight";

function registry(
  input: {
    relationshipGrowth?: number;
    personalityTags?: string[];
    relationshipBias?: number;
    traitTags?: string[];
  } = {},
) {
  const personality: PersonalityDefinition = {
    id: personalityId,
    name: "重み確認",
    description: "Phase21重み確認用",
    trainingStability: 0,
    moraleVolatility: 0,
    relationshipGrowth: input.relationshipGrowth ?? 20,
    pressureModifier: 0,
    tags: input.personalityTags ?? ["focus"],
  };
  const characterTrait: CharacterTraitDefinition = {
    id: traitId,
    name: "重み個性",
    description: "Phase21重み確認用",
    eventTags: input.traitTags ?? ["focus"],
    relationshipBias: input.relationshipBias ?? 10,
    discoveryConditions: [{ type: "trust-min", value: 1 }],
  };
  return {
    ...gameData,
    personalities: new Map([
      ...gameData.personalities,
      [personality.id, personality] as const,
    ]),
    characterTraits: new Map([
      ...gameData.characterTraits,
      [characterTrait.id, characterTrait] as const,
    ]),
  };
}

function event(overrides: Partial<EventDefinition> = {}): EventDefinition {
  const base = [...gameData.events.values()][0]!;
  return {
    ...base,
    id: "event.phase21-weight",
    category: "relationship",
    tags: ["focus", "cooperation"],
    ...overrides,
  };
}

function actors(revealed = true) {
  const state = structuredClone(createDemoGame());
  const ids = state.schools[state.userSchoolId]!.playerIds.slice(0, 2) as [
    PlayerId,
    PlayerId,
  ];
  for (const id of ids) {
    state.players[id] = {
      ...state.players[id]!,
      personalityId,
      hiddenTraitIds: [traitId],
      revealedHiddenTraitIds: revealed ? [traitId] : [],
    };
  }
  state.playerRelationshipBonds = {};
  return { state, ids };
}

describe("Phase21 character-aware event weight", () => {
  it("uses public personality but ignores an unrevealed hidden character trait", () => {
    const { state, ids } = actors(false);
    expect(
      characterEventWeightMultiplier(state, registry(), event(), [ids[0]]),
    ).toBe(120);
  });

  it("adds only revealed character trait tags and relationship bias", () => {
    const { state, ids } = actors(true);
    expect(
      characterEventWeightMultiplier(state, registry(), event(), [ids[0]]),
    ).toBe(145);
  });

  it("adds a matching special bond once and clamps the final multiplier to 150", () => {
    const { state, ids } = actors(true);
    state.playerRelationshipBonds[relationshipKey(ids[0], ids[1])] = {
      playerIds: [...ids].sort() as [PlayerId, PlayerId],
      tags: [
        {
          kind: "partner",
          establishedDate: state.date,
          sourceEventId: null,
          lastReinforcedDate: state.date,
          belowThresholdSince: null,
        },
      ],
    };
    expect(characterEventWeightMultiplier(state, registry(), event(), ids)).toBe(
      150,
    );
  });

  it("clamps negative relationship tendencies to a floor of 75", () => {
    const { state, ids } = actors(true);
    expect(
      characterEventWeightMultiplier(
        state,
        registry({
          relationshipGrowth: -20,
          personalityTags: ["other"],
          relationshipBias: -10,
          traitTags: ["other"],
        }),
        event({ tags: ["focus"] }),
        ids,
      ),
    ).toBe(75);
  });

  it("does not apply relationship bias outside relationship/rivalry categories", () => {
    const { state, ids } = actors(false);
    expect(
      characterEventWeightMultiplier(
        state,
        registry({ personalityTags: ["other"] }),
        event({ category: "practice", tags: ["focus"] }),
        [ids[0]],
      ),
    ).toBe(100);
  });
});
