import type { RawGameData } from "../domain/validation/gameDataSchema";
import { eventCatalog } from "./events/eventCatalog";
import { individualTrainingInstructions } from "./individualTrainingInstructions";
import { rawGameData } from "./rawGameData";

export const completeRawGameData = {
  ...rawGameData,
  events: eventCatalog,
  individualTrainingInstructions,
} satisfies RawGameData;
