import type { CloudGameSnapshot } from "../../worker/data/GameStore";
import type { GameActionRequest } from "../../worker/game/actionSchema";

const DATABASE_NAME = "court-legacy-v2";
const DATABASE_VERSION = 1;
const RECOVERY_STORE = "recovery";

export interface RecoveryRecord {
  userId: string;
  snapshot: CloudGameSnapshot;
  pendingOperation: GameActionRequest | null;
  updatedAt: string;
}

export interface RecoveryRecordStore {
  get(userId: string): Promise<RecoveryRecord | null>;
  put(record: RecoveryRecord): Promise<void>;
  delete(userId: string): Promise<void>;
}

export interface RecoveryCachePort {
  read(userId: string): Promise<RecoveryRecord | null>;
  write(record: RecoveryRecord): Promise<void>;
  clear(userId: string): Promise<void>;
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

class IndexedDbRecoveryRecordStore implements RecoveryRecordStore {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async get(userId: string): Promise<RecoveryRecord | null> {
    const database = await this.openDatabase();
    const transaction = database.transaction(RECOVERY_STORE, "readonly");
    const done = transactionAsPromise(transaction);
    const record = await requestAsPromise(
      transaction.objectStore(RECOVERY_STORE).get(userId) as IDBRequest<
        RecoveryRecord | undefined
      >,
    );
    await done;
    return record ?? null;
  }

  async put(record: RecoveryRecord): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(RECOVERY_STORE, "readwrite");
    const done = transactionAsPromise(transaction);
    transaction.objectStore(RECOVERY_STORE).put(record);
    await done;
  }

  async delete(userId: string): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(RECOVERY_STORE, "readwrite");
    const done = transactionAsPromise(transaction);
    transaction.objectStore(RECOVERY_STORE).delete(userId);
    await done;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.addEventListener("upgradeneeded", () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(RECOVERY_STORE)) {
          database.createObjectStore(RECOVERY_STORE, { keyPath: "userId" });
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

export class RecoveryCache implements RecoveryCachePort {
  constructor(
    private readonly store: RecoveryRecordStore =
      new IndexedDbRecoveryRecordStore(),
  ) {}

  read(userId: string): Promise<RecoveryRecord | null> {
    return this.store.get(userId);
  }

  write(record: RecoveryRecord): Promise<void> {
    return this.store.put(record);
  }

  clear(userId: string): Promise<void> {
    return this.store.delete(userId);
  }
}

export const browserRecoveryCache = new RecoveryCache();
