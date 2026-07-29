import { selectBackupIdsToDelete } from "../../../src/persistence/backupRotation";

function backup(id: string, createdAt: string) {
  return { id, createdAt };
}

describe("backup rotation", () => {
  it("keeps the newest ten backups and returns older ids", () => {
    const backups = Array.from({ length: 12 }, (_, index) =>
      backup(
        `backup-${index + 1}`,
        new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      ),
    );

    expect(selectBackupIdsToDelete(backups, 10)).toEqual([
      "backup-2",
      "backup-1",
    ]);
  });

  it("does not delete anything when the limit is not exceeded", () => {
    const backups = [
      backup("backup-2", "2026-01-02T00:00:00.000Z"),
      backup("backup-1", "2026-01-01T00:00:00.000Z"),
    ];

    expect(selectBackupIdsToDelete(backups, 10)).toEqual([]);
  });

  it("rejects an invalid retention limit", () => {
    expect(() => selectBackupIdsToDelete([], 0)).toThrow(
      "backup limit must be positive",
    );
  });
});
