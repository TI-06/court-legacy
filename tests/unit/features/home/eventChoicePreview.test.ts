import { describe, expect, it } from "vitest";
import type { EventChoiceDefinition } from "../../../../src/domain/validation/gameDataSchema";
import { previewEventChoice } from "../../../../src/features/home/eventChoicePreview";

describe("event choice effect preview", () => {
  it("distinguishes benefits and costs using the actual authored effect values", () => {
    const choice: EventChoiceDefinition = {
      id: "intensive",
      label: "負荷をかけて練習する",
      detail: "成長するが疲労も増える",
      effects: [
        { type: "ability-change", ability: "spike", amount: 3 },
        { type: "fatigue-change", amount: 12 },
        { type: "funds-change", amount: -200 },
      ],
    };
    expect(previewEventChoice(choice)).toEqual([
      { label: "スパイク +3", tone: "up" },
      { label: "疲労 +12", tone: "down" },
      { label: "資金 -200", tone: "down" },
    ]);
  });

  it("labels non-guaranteed skill rolls and follow-up probability accurately", () => {
    const choice: EventChoiceDefinition = {
      id: "try",
      label: "挑戦",
      detail: "特殊能力のチャンス",
      effects: [
        { type: "special-ability-acquire", abilityId: "gold_absolute_ace", amount: 1 },
        { type: "fatigue-change", amount: -8 },
      ],
      followUp: {
        eventId: "event.next-stage",
        afterWeeks: 3,
        probability: 70,
      },
    };
    expect(previewEventChoice(choice)).toEqual([
      { label: "特殊能力の習得判定", tone: "neutral" },
      { label: "疲労 -8", tone: "up" },
      { label: "3週後に続編（70%）", tone: "neutral" },
    ]);
  });
});
