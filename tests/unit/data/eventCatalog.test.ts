import { completeRawGameData } from "../../../src/data/completeRawGameData";

const CHAIN_EVENT_IDS = [
  "event.reserve-frustration",
  "event.reserve-role-review",
  "event.reserve-breakthrough",
  "event.setter-attacker-misalignment",
  "event.setter-attacker-dialogue",
  "event.setter-attacker-trust",
  "event.captain-confidence-crack",
  "event.captain-small-success",
  "event.captain-leadership-choice",
  "event.recurring-injury-warning",
  "event.recurring-injury-rehab",
  "event.recurring-injury-return",
  "event.rival-rematch",
  "event.rival-analysis-week",
  "event.rival-rematch-result",
] as const;

const REQUIRED_CATEGORIES = [
  "individual",
  "relationship",
  "practice",
  "injury",
  "academic",
  "match",
  "captaincy",
  "scouting",
  "rivalry",
  "ob",
  "rare",
  "seasonal",
] as const;

function effectDirection(effect: { type: string; amount?: number }): number {
  if (effect.type === "fatigue-change") {
    return Math.sign(-(effect.amount ?? 0));
  }
  if (effect.type === "injury-clear") {
    return 1;
  }
  if (effect.type === "injury-set" || effect.type === "remove-trait") {
    return -1;
  }
  if (effect.type === "add-trait") {
    return 1;
  }
  return Math.sign(effect.amount ?? 0);
}

describe("event catalog", () => {
  it("contains 70 standalone events and 15 chain stages", () => {
    const events = completeRawGameData.events;
    const chainIds = new Set<string>(CHAIN_EVENT_IDS);

    expect(events).toHaveLength(85);
    expect(events.filter((event) => chainIds.has(event.id))).toHaveLength(15);
    expect(events.filter((event) => !chainIds.has(event.id))).toHaveLength(70);
    expect(new Set(events.map((event) => event.id)).size).toBe(85);
  });

  it("contains five complete three-stage event chains", () => {
    const eventsById = new Map(
      completeRawGameData.events.map((event) => [event.id, event]),
    );
    const chains = [
      [
        "event.reserve-frustration",
        "event.reserve-role-review",
        "event.reserve-breakthrough",
      ],
      [
        "event.setter-attacker-misalignment",
        "event.setter-attacker-dialogue",
        "event.setter-attacker-trust",
      ],
      [
        "event.captain-confidence-crack",
        "event.captain-small-success",
        "event.captain-leadership-choice",
      ],
      [
        "event.recurring-injury-warning",
        "event.recurring-injury-rehab",
        "event.recurring-injury-return",
      ],
      [
        "event.rival-rematch",
        "event.rival-analysis-week",
        "event.rival-rematch-result",
      ],
    ] as const;

    for (const [firstId, secondId, thirdId] of chains) {
      const first = eventsById.get(firstId);
      const second = eventsById.get(secondId);
      const third = eventsById.get(thirdId);
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(third).toBeDefined();
      expect(
        first?.choices.every((choice) => choice.followUp?.eventId === secondId),
      ).toBe(true);
      expect(
        second?.choices.every((choice) => choice.followUp?.eventId === thirdId),
      ).toBe(true);
      expect(third?.choices.every((choice) => !choice.followUp)).toBe(true);
    }
  });

  it("covers every planned category with meaningful choices and trade-offs", () => {
    const events = completeRawGameData.events;
    const presentCategories = new Set(events.map((event) => event.category));

    for (const category of REQUIRED_CATEGORIES) {
      expect(presentCategories.has(category)).toBe(true);
    }

    for (const event of events) {
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      expect(new Set(event.choices.map((choice) => choice.label)).size).toBe(
        event.choices.length,
      );
      const directions = event.choices.flatMap((choice) =>
        choice.effects.map(effectDirection),
      );
      expect(directions).toContain(1);
      expect(directions).toContain(-1);
    }
  });

  it("keeps every follow-up reference inside the catalog", () => {
    const eventIds = new Set(
      completeRawGameData.events.map((event) => event.id),
    );

    for (const event of completeRawGameData.events) {
      for (const choice of event.choices) {
        if (choice.followUp) {
          expect(eventIds.has(choice.followUp.eventId)).toBe(true);
        }
        for (const effect of choice.effects) {
          if (effect.type === "schedule-event") {
            expect(eventIds.has(effect.eventId)).toBe(true);
          }
        }
      }
    }
  });
});
