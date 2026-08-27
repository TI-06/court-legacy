import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import {
  RecoveryCache,
  type RecoveryRecord,
  type RecoveryRecordStore,
} from "../../../src/persistence/RecoveryCache";

function snapshot(revision: number) {
  const state = createInitialGame({
    seed: `recovery-${revision}`,
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高城 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
  return {
    userId: "user-1",
    schoolDbId: "school-1",
    revision,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

class MemoryRecordStore implements RecoveryRecordStore {
  records = new Map<string, RecoveryRecord>();

  async get(userId: string) {
    return this.records.get(userId) ?? null;
  }

  async put(record: RecoveryRecord) {
    this.records.set(record.userId, structuredClone(record));
  }

  async delete(userId: string) {
    this.records.delete(userId);
  }
}

describe("RecoveryCache", () => {
  it("keeps exactly the latest recovery record for each authenticated user", async () => {
    const store = new MemoryRecordStore();
    const cache = new RecoveryCache(store);

    await cache.write({
      userId: "user-1",
      snapshot: snapshot(1),
      pendingOperation: null,
      updatedAt: "2026-08-27T00:00:00.000Z",
    });
    await cache.write({
      userId: "user-1",
      snapshot: snapshot(2),
      pendingOperation: null,
      updatedAt: "2026-08-27T00:01:00.000Z",
    });
    const other = snapshot(3);
    other.userId = "user-2";
    await cache.write({
      userId: "user-2",
      snapshot: other,
      pendingOperation: null,
      updatedAt: "2026-08-27T00:02:00.000Z",
    });

    expect(store.records.size).toBe(2);
    expect((await cache.read("user-1"))?.snapshot.revision).toBe(2);
    expect((await cache.read("user-2"))?.snapshot.revision).toBe(3);
  });

  it("clears only the requested user's recovery record", async () => {
    const store = new MemoryRecordStore();
    const cache = new RecoveryCache(store);
    const first = snapshot(1);
    const second = snapshot(2);
    second.userId = "user-2";

    await cache.write({
      userId: "user-1",
      snapshot: first,
      pendingOperation: null,
      updatedAt: "2026-08-27T00:00:00.000Z",
    });
    await cache.write({
      userId: "user-2",
      snapshot: second,
      pendingOperation: null,
      updatedAt: "2026-08-27T00:00:00.000Z",
    });

    await cache.clear("user-1");

    expect(await cache.read("user-1")).toBeNull();
    expect(await cache.read("user-2")).not.toBeNull();
  });
});
