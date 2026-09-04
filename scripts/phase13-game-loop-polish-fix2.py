from pathlib import Path

path = Path("src/features/school/SchoolScreen.tsx")
text = path.read_text()
old = "{destinyRival.shortName}・因縁 {destinyRivalScore}"
new = "{destinyRival.name}・因縁 {destinyRivalScore}"
count = text.count(old)
if count != 1:
    raise RuntimeError(f"expected one compact rival-name replacement, found {count}")
path.write_text(text.replace(old, new, 1))
print("Phase 13 compact header keeps the full rival school name")
