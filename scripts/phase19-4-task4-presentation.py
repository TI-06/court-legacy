from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected marker once, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/features/match/matchPresentation.ts",
    '''    case "timeout":\n      return "タイムアウト";\n    case "injury":''',
    '''    case "timeout":\n      return "タイムアウト";\n    case "tactic-change":\n      return "戦術変更";\n    case "injury":''',
)

replace_once(
    "src/features/match/matchPresentation.ts",
    '''    case "timeout":\n      return `${winner}がタイムアウトを取ります。`;\n    case "injury":''',
    '''    case "timeout":\n      return `${winner}がタイムアウトを取ります。`;\n    case "tactic-change":\n      return `${winner}が試合中の戦術を変更しました。`;\n    case "injury":''',
)
