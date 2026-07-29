export interface BackupTimestampRecord {
  id: string;
  createdAt: string;
}

export function selectBackupIdsToDelete(
  backups: readonly BackupTimestampRecord[],
  limit: number,
): string[] {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new Error("backup limit must be positive");
  }

  return [...backups]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(limit)
    .map((item) => item.id);
}
