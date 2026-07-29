import type { GameState } from "../domain/model/GameState";

export const SAVE_SLOT_IDS = ["slot-1", "slot-2", "slot-3"] as const;

export type SaveSlotId = (typeof SAVE_SLOT_IDS)[number];
export type BackupReason = "manual" | "autosave" | "import" | "pre-match";

export interface SaveSlotSummary {
  slotId: SaveSlotId;
  exists: boolean;
  updatedAt: string | null;
  schoolName: string | null;
  gameDate: string | null;
  yearIndex: number | null;
  backupCount: number;
}

export interface GameRepository {
  listSlots(): Promise<SaveSlotSummary[]>;
  load(slotId: SaveSlotId): Promise<GameState>;
  save(
    slotId: SaveSlotId,
    state: GameState,
    reason?: BackupReason,
  ): Promise<void>;
  createBackup(slotId: SaveSlotId, reason: BackupReason): Promise<void>;
  delete(slotId: SaveSlotId): Promise<void>;
}

export function assertSaveSlotId(value: string): asserts value is SaveSlotId {
  if (!SAVE_SLOT_IDS.includes(value as SaveSlotId)) {
    throw new Error(`unknown save slot: ${value}`);
  }
}
