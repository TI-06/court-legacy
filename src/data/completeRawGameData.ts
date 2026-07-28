import type { RawGameData } from "../domain/validation/gameDataSchema";
import { individualTrainingInstructions } from "./individualTrainingInstructions";
import { rawGameData } from "./rawGameData";

export const completeRawGameData = {
  ...rawGameData,
  individualTrainingInstructions,
} satisfies RawGameData;
