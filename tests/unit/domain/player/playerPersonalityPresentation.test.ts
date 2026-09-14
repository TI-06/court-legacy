import { describe, expect, it } from "vitest";
import { getPlayerPersonalityPresentation } from "../../../../src/domain/player/playerPersonalityPresentation";
import type { PersonalityDefinition } from "../../../../src/domain/validation/gameDataSchema";

function personality(
  overrides: Partial<PersonalityDefinition> = {},
): PersonalityDefinition {
  return {
    id: "personality.test",
    name: "負けず嫌い",
    description: "競争で火が付く",
    trainingStability: 0,
    moraleVolatility: 50,
    relationshipGrowth: 0,
    pressureModifier: 0,
    tags: ["rivalry"],
    ...overrides,
  };
}

describe("getPlayerPersonalityPresentation", () => {
  it("maps positive thresholds to qualitative labels", () => {
    expect(
      getPlayerPersonalityPresentation(
        personality({
          trainingStability: 6,
          relationshipGrowth: 6,
          pressureModifier: 6,
          moraleVolatility: 35,
        }),
      ),
    ).toEqual({
      name: "負けず嫌い",
      description: "競争で火が付く",
      trainingStability: "安定",
      relationshipBuilding: "得意",
      pressureResponse: "強い",
      moraleVolatility: "安定",
    });
  });

  it("maps negative thresholds to qualitative labels", () => {
    expect(
      getPlayerPersonalityPresentation(
        personality({
          trainingStability: -6,
          relationshipGrowth: -3,
          pressureModifier: -6,
          moraleVolatility: 65,
        }),
      ),
    ).toMatchObject({
      trainingStability: "波あり",
      relationshipBuilding: "苦手",
      pressureResponse: "弱い",
      moraleVolatility: "揺れやすい",
    });
  });

  it("keeps values inside the boundaries neutral", () => {
    expect(
      getPlayerPersonalityPresentation(
        personality({
          trainingStability: 5,
          relationshipGrowth: -2,
          pressureModifier: -5,
          moraleVolatility: 36,
        }),
      ),
    ).toMatchObject({
      trainingStability: "標準",
      relationshipBuilding: "標準",
      pressureResponse: "標準",
      moraleVolatility: "標準",
    });
  });
});
