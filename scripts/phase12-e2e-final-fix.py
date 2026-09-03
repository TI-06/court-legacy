from pathlib import Path

path = Path("src/features/school/school-screen.css")
text = path.read_text(encoding="utf-8")
marker = """@media (max-width: 350px) {\n  .school-segments button {\n"""
if marker not in text:
    raise RuntimeError("school mobile media query marker missing")
insert = """@media (max-width: 350px) {\n  .facility-tile__top strong {\n    overflow: visible;\n    line-height: 1.25;\n    overflow-wrap: anywhere;\n    text-overflow: clip;\n    white-space: normal;\n  }\n}\n\n"""
if insert not in text:
    text = text.replace(marker, insert + marker, 1)
path.write_text(text, encoding="utf-8")
