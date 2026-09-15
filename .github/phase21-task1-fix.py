from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one match in {path}, got {count}: {old!r}")
    target.write_text(text.replace(old, new, 1))


path = "src/domain/relationships/specialRelationships.ts"
replace_once(
    path,
    '''interface AddSpecialRelationshipInput {
  left: PlayerId;
  right: PlayerId;
  kind: SpecialRelationshipKind;
  gameDate: GameDate;
''',
    '''interface AddSpecialRelationshipInput {
  playerIds: [PlayerId, PlayerId];
  kind: SpecialRelationshipKind;
  establishedDate: GameDate;
''',
)
replace_once(
    path,
    '''interface RemoveSpecialRelationshipInput {
  left: PlayerId;
  right: PlayerId;
  kind: SpecialRelationshipKind;
}
''',
    '''interface RemoveSpecialRelationshipInput {
  playerIds: [PlayerId, PlayerId];
  kind: SpecialRelationshipKind;
}
''',
)
replace_once(
    path,
    'throw new Error("special relationship requires different players");',
    'throw new Error("self relationship is not allowed");',
)
replace_once(
    path,
    "  const pair = canonicalPair(input.left, input.right);\n",
    "  const pair = canonicalPair(...input.playerIds);\n",
)
replace_once(
    path,
    "  const pair = canonicalPair(input.left, input.right);\n",
    "  const pair = canonicalPair(...input.playerIds);\n",
)
text = Path(path).read_text().replace("input.gameDate", "input.establishedDate")
Path(path).write_text(text)

replace_once(
    "src/domain/model/Player.ts",
    "  revealedHiddenTraitIds: string[];\n  hiddenTraitAssignmentInitialized: boolean;\n",
    "  revealedHiddenTraitIds?: string[];\n  hiddenTraitAssignmentInitialized?: boolean;\n",
)
