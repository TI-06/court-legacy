import { gameData } from "../../../src/app/createDemoGame";
import { getSpecialAbilityDefinition } from "../../../src/domain/player/specialAbilities";

describe("special ability event data", () => {
  it("references only known special abilities", () => {
    for (const event of gameData.events.values()) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (
            effect.type !== "special-ability-tip" &&
            effect.type !== "special-ability-add" &&
            effect.type !== "special-ability-remove"
          ) {
            continue;
          }

          expect(
            getSpecialAbilityDefinition(effect.abilityId),
            `${event.id}/${choice.id} references ${effect.abilityId}`,
          ).toBeDefined();
        }
      }
    }
  });

  it("uses only known special abilities in event triggers", () => {
    for (const event of gameData.events.values()) {
      for (const abilityId of [
        ...(event.trigger.requiredSpecialAbilityIds ?? []),
        ...(event.trigger.excludedSpecialAbilityIds ?? []),
      ]) {
        expect(
          getSpecialAbilityDefinition(abilityId),
          `${event.id} trigger references ${abilityId}`,
        ).toBeDefined();
      }
    }
  });

  it("defines twelve camp events with a special ability outcome on every choice", () => {
    const campEvents = [...gameData.events.values()].filter((event) =>
      event.tags.includes("camp-event"),
    );

    expect(campEvents).toHaveLength(12);
    for (const event of campEvents) {
      expect(event.trigger.tournamentStages).toContain("camp");
      for (const choice of event.choices) {
        expect(
          choice.effects.some(
            (effect) =>
              effect.type === "special-ability-tip" ||
              effect.type === "special-ability-add" ||
              effect.type === "special-ability-remove",
          ),
          `${event.id}/${choice.id} must change special ability progression`,
        ).toBe(true);
      }
    }
  });

  it("provides awakening routes for every elite and gold ability", () => {
    const awakeningEvents = [...gameData.events.values()].filter((event) =>
      event.tags.some(
        (tag) => tag === "elite-awakening" || tag === "gold-awakening",
      ),
    );
    const awakenedAbilityIds = new Set(
      awakeningEvents.flatMap((event) =>
        event.choices
          .flatMap((choice) => choice.effects)
          .filter((effect) => effect.type === "special-ability-add")
          .map((effect) => effect.abilityId),
      ),
    );
    const expectedAbilityIds = [
      "elite_serve_craftsman",
      "elite_service_ace",
      "elite_serve_hunter",
      "elite_court_hitter",
      "elite_block_crusher",
      "elite_fast_finisher",
      "elite_allround_attacker",
      "elite_game_maker",
      "elite_deception_set",
      "elite_defense_craftsman",
      "elite_receive_wall",
      "elite_block_commander",
      "elite_shutdown",
      "elite_clutch",
      "elite_steel_mental",
      "gold_absolute_ace",
      "gold_serve_king",
      "gold_commander",
      "gold_guardian",
      "gold_iron_wall",
      "gold_flow_controller",
      "gold_indomitable",
      "gold_total_player",
      "gold_ultra_quick",
      "gold_court_brain",
    ];

    expect(awakeningEvents).toHaveLength(25);
    expect([...awakenedAbilityIds].sort()).toEqual(expectedAbilityIds.sort());
  });
});
