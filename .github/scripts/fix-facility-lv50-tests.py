from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    target.write_text(text.replace(old, new, 1))


replace_once(
    "tests/unit/features/school/AppSchoolCalendarFlow.test.tsx",
    'expect(within(trainingFacilityTile).getByText("Lv.1")).toBeInTheDocument();',
    'expect(within(trainingFacilityTile).getByText("Lv.1 / 50")).toBeInTheDocument();',
)
replace_once(
    "tests/unit/features/school/SchoolScreen.test.tsx",
    "        gym: 5,",
    "        gym: 50,",
)
