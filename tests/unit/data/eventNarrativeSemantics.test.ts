import { completeRawGameData } from "../../../src/data/completeRawGameData";

function eventById(id: string) {
  const event = completeRawGameData.events.find(
    (candidate) => candidate.id === id,
  );
  expect(event).toBeDefined();
  return event!;
}

describe("event narrative semantics", () => {
  it("models the ace comeback chain as injury, rehabilitation, clearance, and return", () => {
    const injury = eventById("event.ace-injury");
    const rehabilitation = eventById("event.ace-rehab");
    const returnPractice = eventById("event.ace-return-practice");
    const selection = eventById("event.ace-selection");
    const comeback = eventById("event.ace-comeback");

    expect(
      injury.choices.every((choice) =>
        choice.effects.some((effect) => effect.type === "injury-set"),
      ),
    ).toBe(true);
    expect(
      rehabilitation.choices.every((choice) =>
        choice.effects.every((effect) => effect.type !== "injury-clear"),
      ),
    ).toBe(true);
    expect(
      returnPractice.choices.every((choice) =>
        choice.effects.some((effect) => effect.type === "injury-clear"),
      ),
    ).toBe(true);
    expect(selection.choices.map((choice) => choice.label)).toEqual([
      "先発で戻す",
      "途中出場から始める",
    ]);
    expect(comeback.choices.map((choice) => choice.label)).toEqual([
      "エースへ託す",
      "全員で攻める",
    ]);
  });
});
