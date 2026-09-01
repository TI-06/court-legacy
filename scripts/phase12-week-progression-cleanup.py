from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src/domain/calendar/weekProgression.ts"
t = p.read_text(encoding="utf-8")

old = '''function recoverPlayer(\n  player: Player,\n  _recoveryRoomLevel: number,\n  _isResting: boolean,\n): { player: Player; recovered: boolean; healed: boolean } {\n  const previousInjury = player.injury;\n  const injury = progressInjury(previousInjury);\n  return {\n    player: { ...player, injury },\n    recovered: false,\n    healed: Boolean(previousInjury && !injury),\n  };\n}\n\nfunction recoveryRoomLevelsByPlayer(state: GameState): Map<PlayerId, number> {\n  const levels = new Map<PlayerId, number>();\n  for (const school of Object.values(state.schools)) {\n    for (const playerId of school.playerIds) {\n      levels.set(playerId, school.facilities.recoveryRoom);\n    }\n  }\n  return levels;\n}\n'''
new = '''function recoverPlayer(\n  player: Player,\n): { player: Player; recovered: boolean; healed: boolean } {\n  const previousInjury = player.injury;\n  const injury = progressInjury(previousInjury);\n  return {\n    player: { ...player, injury },\n    recovered: false,\n    healed: Boolean(previousInjury && !injury),\n  };\n}\n'''
if old not in t:
    raise SystemExit("weekly recovery block not found")
t = t.replace(old, new, 1)

t = t.replace(
    '''  const healedPlayerIds: PlayerId[] = [];\n  const recoveryLevels = recoveryRoomLevelsByPlayer(state);\n\n''',
    '''  const healedPlayerIds: PlayerId[] = [];\n  // Kept in the public signature for save/action compatibility; Phase 12 no longer\n  // applies automatic rest or facility-driven fatigue recovery during week advance.\n  void options;\n\n''',
    1,
)

old_call = '''    const result = recoverPlayer(\n      player,\n      recoveryLevels.get(playerId) ?? 0,\n      options.restingPlayerIds?.has(playerId) ?? false,\n    );'''
if old_call not in t:
    raise SystemExit("recoverPlayer call not found")
t = t.replace(old_call, '    const result = recoverPlayer(player);', 1)

p.write_text(t, encoding="utf-8")
