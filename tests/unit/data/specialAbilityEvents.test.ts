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
});
