import type { GameState } from "../domain/model/GameState";
import { selectBackupIdsToDelete } from "./backupRotation";
import {
  SAVE_SLOT_IDS,
  assertSaveSlotId,
  type BackupReason,
  type GameRepository,
  type SaveSlotId,
  type SaveSlotSummary,
} from "./GameRepository";
import { decodeGameState, encodeGameState } from "./gameStateCodec";

const DATABASE_NAME = "court-legacy";
const DATABASE_VERSION = 1;
const SAVE_STORE = "saves";
const BACKUP_STORE = "backups";
const BACKUP_LIMIT = 10;

interface SaveRecord {
  slotId: SaveSlotId;
  payload: string;
  updatedAt: string;
  schoolName: string;
  gameDate: string;
  yearIndex: number;
}

interface BackupRecord {
  id: string;
  slotId: SaveSlotId;
  payload: string;
  createdAt: string;
  reason: BackupReason;
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () =>
      reject(request.error ?? new Error("IndexedDB request failed")),
    );
  });
}

function transactionAsPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted")),
    );
    transaction.addEventListener("error", () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed")),
    );
  });
}

function createBackupId(slotId: SaveSlotId, createdAt: string): string {
  const randomPart =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${slotId}-${createdAt}-${randomPart}`;
}

export class IndexedDbGameRepository implements GameRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async listSlots(): Promise<SaveSlotSummary[]> {
    const database = await this.openDatabase();
    const transaction = database.transaction(
      [SAVE_STORE, BACKUP_STORE],
      "readonly",
    );
    const done = transactionAsPromise(transaction);
    const saves = await requestAsPromise(
      transaction.objectStore(SAVE_STORE).getAll() as IDBRequest<SaveRecord[]>,
    );
    const backups = await requestAsPromise(
      transaction.objectStore(BACKUP_STORE).getAll() as IDBRequest<
        BackupRecord[]
      >,
    );
    await done;

    const saveBySlot = new Map(saves.map((save) => [save.slotId, save]));
    const backupCountBySlot = new Map<SaveSlotId, number>();
    for (const backup of backups) {
      backupCountBySlot.set(
        backup.slotId,
        (backupCountBySlot.get(backup.slotId) ?? 0) + 1,
      );
    }

    return SAVE_SLOT_IDS.map((slotId) => {
      const save = saveBySlot.get(slotId);
      return {
        slotId,
        exists: Boolean(save),
        updatedAt: save?.updatedAt ?? null,
        schoolName: save?.schoolName ?? null,
        gameDate: save?.gameDate ?? null,
        yearIndex: save?.yearIndex ?? null,
        backupCount: backupCountBySlot.get(slotId) ?? 0,
      };
    });
  }

  async load(slotId: SaveSlotId): Promise<GameState> {
    assertSaveSlotId(slotId);
    const database = await this.openDatabase();
    const transaction = database.transaction(SAVE_STORE, "readonly");
    const done = transactionAsPromise(transaction);
    const record = await requestAsPromise(
      transaction.objectStore(SAVE_STORE).get(slotId) as IDBRequest<
        SaveRecord | undefined
      >,
    );
    await done;

    if (!record) {
      throw new Error("セーブデータがありません");
    }

    return decodeGameState(record.payload);
  }

  async save(
    slotId: SaveSlotId,
    state: GameState,
    reason: BackupReason = "manual",
  ): Promise<void> {
    assertSaveSlotId(slotId);
    const payload = encodeGameState(state);
    const userSchool = state.schools[state.userSchoolId];
    if (!userSchool) {
      throw new Error("自校データが見つかりません");
    }

    const database = await this.openDatabase();
    const transaction = database.transaction(
      [SAVE_STORE, BACKUP_STORE],
      "readwrite",
    );
    const done = transactionAsPromise(transaction);
    const saveStore = transaction.objectStore(SAVE_STORE);
    const backupStore = transaction.objectStore(BACKUP_STORE);
    const existing = await requestAsPromise(
      saveStore.get(slotId) as IDBRequest<SaveRecord | undefined>,
    );
    const updatedAt = new Date().toISOString();

    if (existing) {
      backupStore.put({
        id: createBackupId(slotId, updatedAt),
        slotId,
        payload: existing.payload,
        createdAt: updatedAt,
        reason,
      } satisfies BackupRecord);
    }

    saveStore.put({
      slotId,
      payload,
      updatedAt,
      schoolName: userSchool.name,
      gameDate: state.date,
      yearIndex: state.yearIndex,
    } satisfies SaveRecord);
    await done;
    await this.pruneBackups(slotId);
  }

  async createBackup(slotId: SaveSlotId, reason: BackupReason): Promise<void> {
    assertSaveSlotId(slotId);
    const database = await this.openDatabase();
    const transaction = database.transaction(
      [SAVE_STORE, BACKUP_STORE],
      "readwrite",
    );
    const done = transactionAsPromise(transaction);
    const saveStore = transaction.objectStore(SAVE_STORE);
    const existing = await requestAsPromise(
      saveStore.get(slotId) as IDBRequest<SaveRecord | undefined>,
    );

    if (existing) {
      const createdAt = new Date().toISOString();
      transaction.objectStore(BACKUP_STORE).put({
        id: createBackupId(slotId, createdAt),
        slotId,
        payload: existing.payload,
        createdAt,
        reason,
      } satisfies BackupRecord);
    }

    await done;
    await this.pruneBackups(slotId);
  }

  async delete(slotId: SaveSlotId): Promise<void> {
    assertSaveSlotId(slotId);
    const database = await this.openDatabase();
    const transaction = database.transaction(
      [SAVE_STORE, BACKUP_STORE],
      "readwrite",
    );
    const done = transactionAsPromise(transaction);
    transaction.objectStore(SAVE_STORE).delete(slotId);

    const backupStore = transaction.objectStore(BACKUP_STORE);
    const cursorRequest = backupStore
      .index("slotId")
      .openKeyCursor(IDBKeyRange.only(slotId));
    cursorRequest.addEventListener("success", () => {
      const cursor = cursorRequest.result;
      if (!cursor) {
        return;
      }
      backupStore.delete(cursor.primaryKey);
      cursor.continue();
    });

    await done;
  }

  private async pruneBackups(slotId: SaveSlotId): Promise<void> {
    const database = await this.openDatabase();
    const readTransaction = database.transaction(BACKUP_STORE, "readonly");
    const readDone = transactionAsPromise(readTransaction);
    const records = await requestAsPromise(
      readTransaction
        .objectStore(BACKUP_STORE)
        .index("slotId")
        .getAll(IDBKeyRange.only(slotId)) as IDBRequest<BackupRecord[]>,
    );
    await readDone;

    const idsToDelete = selectBackupIdsToDelete(records, BACKUP_LIMIT);
    if (idsToDelete.length === 0) {
      return;
    }

    const writeTransaction = database.transaction(BACKUP_STORE, "readwrite");
    const writeDone = transactionAsPromise(writeTransaction);
    const store = writeTransaction.objectStore(BACKUP_STORE);
    idsToDelete.forEach((id) => store.delete(id));
    await writeDone;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) {
      return this.databasePromise;
    }

    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.addEventListener("upgradeneeded", () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(SAVE_STORE)) {
          database.createObjectStore(SAVE_STORE, { keyPath: "slotId" });
        }
        if (!database.objectStoreNames.contains(BACKUP_STORE)) {
          const backupStore = database.createObjectStore(BACKUP_STORE, {
            keyPath: "id",
          });
          backupStore.createIndex("slotId", "slotId", { unique: false });
        }
      });
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => {
        this.databasePromise = null;
        reject(request.error ?? new Error("IndexedDBを開けません"));
      });
      request.addEventListener("blocked", () => {
        this.databasePromise = null;
        reject(new Error("IndexedDBの更新がブロックされています"));
      });
    });

    return this.databasePromise;
  }
}

export const browserGameRepository = new IndexedDbGameRepository();
