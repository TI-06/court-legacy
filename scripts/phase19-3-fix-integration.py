from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected marker once, found {count}: {old!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''                  selectedFacility,\n                  levels,''',
    '''                  selectedDefinition.key,\n                  levels,''',
)
replace_once(
    "tests/unit/features/school/SchoolScreen.test.tsx",
    '''    expect(screen.getByText("資金 700")).toBeVisible();''',
    '''    expect(screen.getByText("資金 750")).toBeVisible();''',
)
replace_once(
    "tests/unit/features/school/SchoolScreen.test.tsx",
    '''    expect(within(dialog).getByText("630")).toBeVisible();''',
    '''    expect(within(dialog).getByText("680")).toBeVisible();''',
)
