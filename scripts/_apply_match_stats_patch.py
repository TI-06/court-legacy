from pathlib import Path

path = Path("src/features/match/MatchScreen.tsx")
text = path.read_text()

replacements = [
    (
        'import { presentMatchEvent, summarizeSetScore } from "./matchPresentation";\n',
        'import { presentMatchEvent, summarizeSetScore } from "./matchPresentation";\nimport { MatchResultStats, PreMatchComparison } from "./MatchStatPanels";\n',
    ),
    (
        '        </section>\n\n        <section\n          className="match-prep-panel"',
        '        </section>\n\n        <PreMatchComparison\n          state={state}\n          homeSelection={homeSelection}\n          awaySelection={awaySelection}\n          homeStrength={homeStrength}\n          awayStrength={awayStrength}\n        />\n\n        <section\n          className="match-prep-panel"',
    ),
    (
        '              <small>セット {revealedHomeSets}</small>',
        '              <small>セット {revealedHomeSets} ・ 戦力 {homeStrength}</small>',
    ),
    (
        '              <small>セット {revealedAwaySets}</small>',
        '              <small>セット {revealedAwaySets} ・ 戦力 {awayStrength}</small>',
    ),
    (
        '          </section>\n\n          <section className="match-analysis" aria-labelledby="factor-heading">',
        '          </section>\n\n          <MatchResultStats\n            state={state}\n            match={result.match}\n            userSchoolId={state.userSchoolId}\n            homeName={homeShortName}\n            awayName={awayShortName}\n          />\n\n          <section className="match-analysis" aria-labelledby="factor-heading">',
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one match for patch snippet, found {count}: {old[:80]!r}")
    text = text.replace(old, new, 1)

path.write_text(text)
