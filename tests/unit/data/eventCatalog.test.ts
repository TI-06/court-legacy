import { completeRawGameData } from "../../../src/data/completeRawGameData";

const CHAINS = [
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
  [
    "event.generation-arrival",
    "event.generation-spotlight",
    "event.generation-friction",
    "event.generation-trial",
    "event.generation-legacy",
  ],
  [
    "event.tournament-draw",
    "event.tournament-opening",
    "event.tournament-quarterfinal",
    "event.tournament-semifinal",
    "event.tournament-final",
  ],
  [
    "event.alumni-fundraising",
    "event.alumni-plan",
    "event.alumni-workday",
    "event.alumni-opening",
    "event.alumni-legacy-day",
  ],
  [
    "event.ace-injury",
    "event.ace-rehab",
    "event.ace-return-practice",
    "event.ace-selection",
    "event.ace-comeback",
  ],
  [
    "event.scouting-rumor",
    "event.scouting-visit",
    "event.scouting-counteroffer",
    "event.scouting-decision",
    "event.scouting-aftermath",
  ],
] as const;

const CHAIN_EVENT_IDS = CHAINS.flat();

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
  it("contains 140 standalone events and 40 chain stages", () => {
    const events = completeRawGameData.events;
    const chainIds = new Set<string>(CHAIN_EVENT_IDS);

    expect(events).toHaveLength(180);
    expect(events.filter((event) => chainIds.has(event.id))).toHaveLength(40);
    expect(events.filter((event) => !chainIds.has(event.id))).toHaveLength(140);
    expect(new Set(events.map((event) => event.id)).size).toBe(180);
  });

  it("contains ten complete event chains", () => {
    const eventsById = new Map(
      completeRawGameData.events.map((event) => [event.id, event]),
    );

    for (const chain of CHAINS) {
      chain.forEach((eventId, index) => {
        const event = eventsById.get(eventId);
        const nextId = chain[index + 1];
        expect(event).toBeDefined();
        if (nextId) {
          expect(
            event?.choices.every(
              (choice) => choice.followUp?.eventId === nextId,
            ),
          ).toBe(true);
        } else {
          expect(event?.choices.every((choice) => !choice.followUp)).toBe(true);
        }
      });
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

  it("adds substantial generational, tournament, alumni, and facility content", () => {
    const events = completeRawGameData.events;
    const tagged = (tag: string) =>
      events.filter((event) => event.tags.includes(tag)).length;

    expect(tagged("generational")).toBeGreaterThanOrEqual(12);
    expect(tagged("tournament")).toBeGreaterThanOrEqual(12);
    expect(tagged("alumni")).toBeGreaterThanOrEqual(12);
    expect(tagged("facility")).toBeGreaterThanOrEqual(12);
    expect(
      events.filter((event) => event.category === "rare").length,
    ).toBeGreaterThanOrEqual(10);
    expect(
      events.filter((event) => event.category === "ob").length,
    ).toBeGreaterThanOrEqual(10);
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
