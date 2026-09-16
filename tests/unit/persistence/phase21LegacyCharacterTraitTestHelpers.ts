export function stripCharacterTraitDiscoveryFieldsFromLegacyPlayers(
  players: unknown,
): void {
  const record = players as Record<string, Record<string, unknown>>;
  for (const player of Object.values(record)) {
    delete player.revealedHiddenTraitIds;
    delete player.hiddenTraitAssignmentInitialized;
  }
}

export function withoutCharacterTraitDiscoveryFields(
  players: unknown,
): Record<string, unknown> {
  const record = players as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([playerId, player]) => {
      const copy = structuredClone(player) as Record<string, unknown>;
      delete copy.revealedHiddenTraitIds;
      delete copy.hiddenTraitAssignmentInitialized;
      return [playerId, copy];
    }),
  );
}

export function hasPendingCharacterTraitDiscovery(players: unknown): boolean {
  const record = players as Record<
    string,
    {
      hiddenTraitIds?: unknown;
      revealedHiddenTraitIds?: unknown;
      hiddenTraitAssignmentInitialized?: unknown;
    }
  >;
  return Object.values(record).every(
    (player) =>
      Array.isArray(player.hiddenTraitIds) &&
      player.hiddenTraitAssignmentInitialized === false &&
      Array.isArray(player.revealedHiddenTraitIds) &&
      player.revealedHiddenTraitIds.length === 0,
  );
}
