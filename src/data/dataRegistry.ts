import * as z from "zod";
import {
  rawGameDataSchema,
  type EventDefinition,
  type GrowthTypeDefinition,
  type IndividualTrainingInstructionDefinition,
  type PersonalityDefinition,
  type RawGameData,
  type SchoolArchetypeDefinition,
  type TraitDefinition,
  type TrainingMenuDefinition,
} from "../domain/validation/gameDataSchema";

export type { RawGameData } from "../domain/validation/gameDataSchema";

export interface GameDataRegistry {
  names: RawGameData["names"];
  personalities: ReadonlyMap<string, PersonalityDefinition>;
  growthTypes: ReadonlyMap<string, GrowthTypeDefinition>;
  traits: ReadonlyMap<string, TraitDefinition>;
  trainingMenus: ReadonlyMap<string, TrainingMenuDefinition>;
  individualTrainingInstructions: ReadonlyMap<
    string,
    IndividualTrainingInstructionDefinition
  >;
  schoolArchetypes: ReadonlyMap<string, SchoolArchetypeDefinition>;
  events: ReadonlyMap<string, EventDefinition>;
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((result, part) => {
    if (typeof part === "number") {
      return `${result}[${part}]`;
    }

    return result.length === 0 ? String(part) : `${result}.${String(part)}`;
  }, "");
}

function formatZodError(error: z.ZodError): Error {
  const issue = error.issues[0];
  const path = formatPath(issue?.path ?? []);
  const location = path.length > 0 ? ` at ${path}` : "";
  return new Error(
    `Invalid game data${location}: ${issue?.message ?? "unknown error"}`,
  );
}

function assertUniqueIds<T extends { id: string }>(
  catalogName: string,
  items: readonly T[],
): void {
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      throw new Error(`${catalogName} contains duplicate id: ${item.id}`);
    }
    seen.add(item.id);
  }
}

function assertUniqueNames(
  catalogName: string,
  items: readonly { name: string; reading: string }[],
): void {
  const seen = new Set<string>();

  for (const item of items) {
    const key = `${item.name}|${item.reading}`;
    if (seen.has(key)) {
      throw new Error(`${catalogName} contains duplicate entry: ${key}`);
    }
    seen.add(key);
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return value;
}

function createReadOnlyMap<T>(
  items: readonly T[],
  idOf: (item: T) => string,
): ReadonlyMap<string, T> {
  const target = new Map(items.map((item) => [idOf(item), item]));

  return new Proxy(target, {
    get(map, property) {
      if (property === "set" || property === "delete" || property === "clear") {
        return () => {
          throw new Error("Game data maps are read-only");
        };
      }

      const value = Reflect.get(map, property, map);
      return typeof value === "function" ? value.bind(map) : value;
    },
  });
}

function assertTraitReferences(parsed: RawGameData): void {
  const traitIds = new Set(parsed.traits.map((trait) => trait.id));

  for (const school of parsed.schoolArchetypes) {
    for (const traitId of school.preferredTraitIds) {
      if (!traitIds.has(traitId)) {
        throw new Error(
          `school archetype ${school.id} references unknown trait: ${traitId}`,
        );
      }
    }
  }

  for (const event of parsed.events) {
    for (const traitId of event.trigger.requiredTraitIds ?? []) {
      if (!traitIds.has(traitId)) {
        throw new Error(
          `event ${event.id} references unknown trait: ${traitId}`,
        );
      }
    }
    for (const traitId of event.trigger.excludedTraitIds ?? []) {
      if (!traitIds.has(traitId)) {
        throw new Error(
          `event ${event.id} references unknown trait: ${traitId}`,
        );
      }
    }
    for (const choice of event.choices) {
      for (const effect of choice.effects) {
        if (
          (effect.type === "add-trait" || effect.type === "remove-trait") &&
          !traitIds.has(effect.traitId)
        ) {
          throw new Error(
            `event ${event.id} references unknown trait: ${effect.traitId}`,
          );
        }
      }
    }
  }
}

function assertEventReferences(parsed: RawGameData): void {
  const eventIds = new Set(parsed.events.map((event) => event.id));

  for (const event of parsed.events) {
    for (const choice of event.choices) {
      if (choice.followUp && !eventIds.has(choice.followUp.eventId)) {
        throw new Error(
          `event ${event.id} references unknown follow-up: ${choice.followUp.eventId}`,
        );
      }
      for (const effect of choice.effects) {
        if (effect.type === "schedule-event" && !eventIds.has(effect.eventId)) {
          throw new Error(
            `event ${event.id} references unknown scheduled event: ${effect.eventId}`,
          );
        }
      }
    }
  }
}

export function loadGameData(input: unknown): GameDataRegistry {
  const result = rawGameDataSchema.safeParse(input);
  if (!result.success) {
    throw formatZodError(result.error);
  }

  const parsed = result.data;
  const individualTrainingInstructions =
    parsed.individualTrainingInstructions ?? [];
  assertUniqueNames("names.surnames", parsed.names.surnames);
  assertUniqueNames("names.givenNames", parsed.names.givenNames);
  assertUniqueIds("personalities", parsed.personalities);
  assertUniqueIds("growthTypes", parsed.growthTypes);
  assertUniqueIds("traits", parsed.traits);
  assertUniqueIds("trainingMenus", parsed.trainingMenus);
  assertUniqueIds(
    "individualTrainingInstructions",
    individualTrainingInstructions,
  );
  assertUniqueIds("schoolArchetypes", parsed.schoolArchetypes);
  assertUniqueIds("events", parsed.events);
  assertTraitReferences(parsed);
  assertEventReferences(parsed);

  deepFreeze(parsed);

  return {
    names: parsed.names,
    personalities: createReadOnlyMap(parsed.personalities, (item) => item.id),
    growthTypes: createReadOnlyMap(parsed.growthTypes, (item) => item.id),
    traits: createReadOnlyMap(parsed.traits, (item) => item.id),
    trainingMenus: createReadOnlyMap(parsed.trainingMenus, (item) => item.id),
    individualTrainingInstructions: createReadOnlyMap(
      individualTrainingInstructions,
      (item) => item.id,
    ),
    schoolArchetypes: createReadOnlyMap(
      parsed.schoolArchetypes,
      (item) => item.id,
    ),
    events: createReadOnlyMap(parsed.events, (item) => item.id),
  };
}
