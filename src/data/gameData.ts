import { loadGameData, type GameDataRegistry } from "./dataRegistry";
import { rawGameData } from "./rawGameData";

export type GameDataBootstrapResult =
  { ok: true; data: GameDataRegistry } | { ok: false; message: string };

export function bootstrapGameData(
  input: typeof rawGameData,
): GameDataBootstrapResult {
  try {
    return { ok: true, data: loadGameData(input) };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Unknown game data error",
    };
  }
}

export const gameDataBootstrap = bootstrapGameData(rawGameData);
