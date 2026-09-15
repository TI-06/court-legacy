from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one match in {path}, got {count}: {old!r}")
    target.write_text(text.replace(old, new, 1))


path = "src/domain/calendar/academicYearProgression.ts"
replace_once(
    path,
    '''function promoteGrade(grade: Grade): Grade {\n''',
    '''export function archiveGraduatingRelationships(\n  state: GameState,\n  graduatedPlayerIds: readonly PlayerId[],\n  archivedDate: GameDate,\n): Pick<GameState, "playerRelationshipBonds" | "history"> {\n  const graduated = new Set(graduatedPlayerIds);\n  const playerRelationshipBonds = { ...state.playerRelationshipBonds };\n  const archived = [];\n\n  for (const [key, bond] of Object.entries(state.playerRelationshipBonds)) {\n    if (!bond.playerIds.some((playerId) => graduated.has(playerId))) {\n      continue;\n    }\n\n    const [leftId, rightId] = bond.playerIds;\n    const left = state.players[leftId];\n    const right = state.players[rightId];\n    archived.push({\n      playerIds: [...bond.playerIds] as [PlayerId, PlayerId],\n      displayNames: [\n        left ? `${left.lastName} ${left.firstName}` : String(leftId),\n        right ? `${right.lastName} ${right.firstName}` : String(rightId),\n      ] as [string, string],\n      tags: bond.tags.map((tag) => ({ ...tag })),\n      finalRelationshipScore: state.playerRelationships[key] ?? 50,\n      archivedDate,\n    });\n    delete playerRelationshipBonds[key];\n  }\n\n  return {\n    playerRelationshipBonds,\n    history: {\n      ...state.history,\n      relationshipLegacyHistory: [\n        ...state.history.relationshipLegacyHistory,\n        ...archived,\n      ].slice(-200),\n    },\n  };\n}\n\nfunction promoteGrade(grade: Grade): Grade {\n''',
)
replace_once(
    path,
    '''  nextState = advanceRivalWorld(nextState, data, random);\n  nextState = restoreCanonicalReputation(nextState, schools);\n  nextState = grantAnnualSchoolBudget(nextState);\n  const playerRelationships = rebuildRelationships(nextState, random);\n''',
    '''  nextState = advanceRivalWorld(nextState, data, random);\n  nextState = restoreCanonicalReputation(nextState, schools);\n  nextState = grantAnnualSchoolBudget(nextState);\n  const archivedRelationships = archiveGraduatingRelationships(\n    nextState,\n    graduatedPlayerIds,\n    nextState.date,\n  );\n  nextState = { ...nextState, ...archivedRelationships };\n  const playerRelationships = rebuildRelationships(nextState, random);\n''',
)
