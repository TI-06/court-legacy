from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected marker once, found {count}: {old[:140]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


path = "src/features/match/matchPresentation.ts"

replace_once(
    path,
    '''function titleFor(event: MatchEvent): string {''',
    '''function titleFor(\n  event: MatchEvent,\n  context: MatchPresentationContext,\n): string {''',
)

replace_once(
    path,
    '''    case "tactic-change":\n      return "戦術変更";''',
    '''    case "tactic-change":\n      return event.winnerSchoolId !== null &&\n        event.winnerSchoolId !== context.state.userSchoolId\n        ? "相手戦術変更"\n        : "戦術変更";''',
)

replace_once(
    path,
    '''function detailFor(\n  event: MatchEvent,\n  context: MatchPresentationContext,\n): string {''',
    '''function tacticChangeLabel(detailCode: string): string {\n  const [prefix, source, serve, attack, block] = detailCode.split(".");\n  if (prefix !== "tactic" || source !== "automatic") {\n    return "戦い方";\n  }\n  if (attack === "quick") return "速攻重視";\n  if (attack === "side") return "サイド重視";\n  if (serve === "aggressive") return "強気サーブ";\n  if (serve === "safe") return "安定サーブ";\n  if (block === "commit") return "速攻警戒";\n  if (block === "read") return "サイド警戒";\n  return "バランス型";\n}\n\nfunction detailFor(\n  event: MatchEvent,\n  context: MatchPresentationContext,\n): string {''',
)

replace_once(
    path,
    '''    case "tactic-change":\n      return `${winner}が試合中の戦術を変更しました。`;''',
    '''    case "tactic-change":\n      return `${winner}が${tacticChangeLabel(event.detailCode)}へ変更しました。`;''',
)

replace_once(
    path,
    '''    title: titleFor(event),''',
    '''    title: titleFor(event, context),''',
)
