import { loadGameData, type RawGameData } from "../../../src/data/dataRegistry";
import { rawGameData } from "../../../src/data/rawGameData";

function cloneRawGameData(): RawGameData {
  return structuredClone(rawGameData);
}

describe("game data registry", () => {
  it("loads the built-in data catalog with the release minimums", () => {
    const registry = loadGameData(rawGameData);

    expect(registry.names.surnames.length).toBeGreaterThanOrEqual(40);
    expect(registry.names.givenNames.length).toBeGreaterThanOrEqual(40);
    expect(registry.personalities.size).toBeGreaterThanOrEqual(10);
    expect(registry.growthTypes.size).toBeGreaterThanOrEqual(8);
    expect(registry.traits.size).toBeGreaterThanOrEqual(50);
    expect(registry.trainingMenus.size).toBeGreaterThanOrEqual(12);
    expect(registry.schoolArchetypes.size).toBeGreaterThanOrEqual(8);
    expect(registry.events.size).toBeGreaterThanOrEqual(6);
  });

  it("rejects duplicate IDs with a catalog-specific diagnostic", () => {
    const raw = cloneRawGameData();
    raw.traits.push(structuredClone(raw.traits[0]));

    expect(() => loadGameData(raw)).toThrow(
      "traits contains duplicate id: trait.power-hitter",
    );
  });

  it("rejects duplicate names and readings", () => {
    const raw = cloneRawGameData();
    raw.names.surnames.push(structuredClone(raw.names.surnames[0]));

    expect(() => loadGameData(raw)).toThrow(
      "names.surnames contains duplicate entry: 佐藤|さとう",
    );
  });

  it("rejects invalid ability modifiers", () => {
    const raw = cloneRawGameData();
    raw.traits[0].effects[0] = {
      type: "ability-modifier",
      ability: "spike",
      value: 101,
    };

    expect(() => loadGameData(raw)).toThrow("traits[0].effects[0].value");
  });

  it("rejects event effects that reference an unknown trait", () => {
    const raw = cloneRawGameData();
    raw.events[0].choices[0].effects.push({
      type: "add-trait",
      traitId: "trait.does-not-exist",
    });

    expect(() => loadGameData(raw)).toThrow(
      "event event.first-position-request references unknown trait: trait.does-not-exist",
    );
  });

  it("rejects event follow-ups that reference an unknown event", () => {
    const raw = cloneRawGameData();
    raw.events[0].choices[0].followUp = {
      eventId: "event.missing-follow-up",
      afterWeeks: 2,
      probability: 50,
    };

    expect(() => loadGameData(raw)).toThrow(
      "event event.first-position-request references unknown follow-up: event.missing-follow-up",
    );
  });

  it("rejects training menus without any target ability", () => {
    const raw = cloneRawGameData();
    raw.trainingMenus[0].targetAbilities = [];

    expect(() => loadGameData(raw)).toThrow("trainingMenus[0].targetAbilities");
  });

  it("returns read-only maps detached from the mutable raw input", () => {
    const raw = cloneRawGameData();
    const registry = loadGameData(raw);

    raw.personalities[0].name = "変更後";

    expect(registry.personalities.get("personality.passionate")?.name).toBe(
      "熱血",
    );
    expect(() => {
      registry.personalities.set("personality.invalid", {
        ...registry.personalities.get("personality.passionate")!,
        id: "personality.invalid",
      });
    }).toThrow("Game data maps are read-only");
  });
});
