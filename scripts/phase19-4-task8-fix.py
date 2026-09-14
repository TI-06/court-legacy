from pathlib import Path

path = Path("src/dev/soak/runTacticalMatrix.ts")
text = path.read_text(encoding="utf-8")
text = text.replace(
    'import { matchId } from "../../domain/model/identifiers";',
    'import { matchId, type PlayerId } from "../../domain/model/identifiers";',
)
text = text.replace(
    'const SIDE: MatchTacticPlan = { ...BALANCED, attack: "side" };\n',
    '',
)
text = text.replace(
    '  playerIds: readonly string[],',
    '  playerIds: readonly PlayerId[],',
)
path.write_text(text, encoding="utf-8")
