import { completeRawGameData } from "./completeRawGameData";
import { loadGameData, type GameDataRegistry } from "./dataRegistry";

export type GameDataBootstrapResult =
  { ok: true; data: GameDataRegistry } | { ok: false; message: string };

export function bootstrapGameData(input: unknown): GameDataBootstrapResult {
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

export const gameDataBootstrap = bootstrapGameData(completeRawGameData);
