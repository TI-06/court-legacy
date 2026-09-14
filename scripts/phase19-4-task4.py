from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected marker once, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/domain/match/simulateMatch.ts",
    ''') => Extract<MatchCommand, { type: "timeout" } | { type: "continue" }>;''',
    ''') => Extract<\n  MatchCommand,\n  { type: "timeout" } | { type: "set-match-tactics" } | { type: "continue" }\n>;''',
)

replace_once(
    "src/domain/match/simulateMatch.ts",
    '''  command: Extract<MatchCommand, { type: "timeout" } | { type: "continue" }>,''',
    '''  command: Extract<\n    MatchCommand,\n    { type: "timeout" } | { type: "set-match-tactics" } | { type: "continue" }\n  >,''',
)

replace_once(
    "src/domain/match/simulateMatch.ts",
    '''  if (command.type === "timeout") {\n    if (reason === "set-break") {\n      throw new Error("automatic coach cannot use timeout at a set break");\n    }\n    if (runtime.timeoutUsedSchoolIds.includes(schoolId)) {\n      throw new Error("automatic coach attempted a duplicate timeout");\n    }\n    runtime.timeoutUsedSchoolIds.push(schoolId);\n    runtime.timeoutBoost = { schoolId, ralliesRemaining: 5 };\n    match.eventLog.push({\n      sequence: match.eventLog.length + 1,\n      type: "timeout",\n      setNumber: match.currentSetNumber,\n      homeScore: runtime.homeScore,\n      awayScore: runtime.awayScore,\n      actorPlayerId: null,\n      targetPlayerId: null,\n      winnerSchoolId: schoolId,\n      detailCode: "timeout.automatic-coach",\n    });\n  }''',
    '''  if (command.type === "timeout") {\n    if (reason === "set-break") {\n      throw new Error("automatic coach cannot use timeout at a set break");\n    }\n    if (runtime.timeoutUsedSchoolIds.includes(schoolId)) {\n      throw new Error("automatic coach attempted a duplicate timeout");\n    }\n    runtime.timeoutUsedSchoolIds.push(schoolId);\n    runtime.timeoutBoost = { schoolId, ralliesRemaining: 5 };\n    match.eventLog.push({\n      sequence: match.eventLog.length + 1,\n      type: "timeout",\n      setNumber: match.currentSetNumber,\n      homeScore: runtime.homeScore,\n      awayScore: runtime.awayScore,\n      actorPlayerId: null,\n      targetPlayerId: null,\n      winnerSchoolId: schoolId,\n      detailCode: "timeout.automatic-coach",\n    });\n  } else if (command.type === "set-match-tactics") {\n    if (schoolId === match.homeSchoolId) {\n      runtime.homeTactics = structuredClone(command.plan);\n    } else if (schoolId === match.awaySchoolId) {\n      runtime.awayTactics = structuredClone(command.plan);\n    } else {\n      throw new Error("automatic coach school must be part of the match");\n    }\n    match.eventLog.push({\n      sequence: match.eventLog.length + 1,\n      type: "tactic-change",\n      setNumber: match.currentSetNumber,\n      homeScore: runtime.homeScore,\n      awayScore: runtime.awayScore,\n      actorPlayerId: null,\n      targetPlayerId: null,\n      winnerSchoolId: schoolId,\n      detailCode: `tactic.automatic.${command.plan.serve}.${command.plan.attack}.${command.plan.block}`,\n    });\n  }''',
)

replace_once(
    "src/domain/model/Match.ts",
    '''  | "timeout"\n  | "injury"''',
    '''  | "timeout"\n  | "tactic-change"\n  | "injury"''',
)
