from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected marker once, found {count}: {old[:140]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


path = "worker/game/applyGameAction.ts"

replace_once(
    path,
    '''import {\n  applyMatchCommand,\n  MatchCommandValidationError,\n} from "../../src/domain/match/applyMatchCommand";\nimport {\n  resumeMatch,\n  simulateMatch,\n  startMatch,\n  type MatchStepResult,\n  type SimulateMatchResult,\n} from "../../src/domain/match/simulateMatch";''',
    '''import {\n  applyMatchCommand,\n  MatchCommandValidationError,\n} from "../../src/domain/match/applyMatchCommand";\nimport {\n  decideCpuCoachCommand,\n  type CpuCoachPublicView,\n} from "../../src/domain/match/cpuCoachPolicy";\nimport {\n  resumeMatch,\n  simulateMatch,\n  startMatch,\n  type AutomaticCoachDecisionInput,\n  type MatchStepResult,\n  type SimulateMatchResult,\n} from "../../src/domain/match/simulateMatch";\nimport type { MatchState } from "../../src/domain/model/Match";''',
)

replace_once(
    path,
    '''import { matchId } from "../../src/domain/model/identifiers";''',
    '''import { matchId, type SchoolId } from "../../src/domain/model/identifiers";''',
)

replace_once(
    path,
    '''  return applyUserMatchExperience({\n    state,\n    data: gameData,\n    match,\n    selection: userSelection,\n    strongerOpponent: opponentStrength > userStrength + 2,\n  });\n}\n\nfunction consumeNextTrainingGrowthBoost''',
    '''  return applyUserMatchExperience({\n    state,\n    data: gameData,\n    match,\n    selection: userSelection,\n    strongerOpponent: opponentStrength > userStrength + 2,\n  });\n}\n\nfunction cpuPublicStats(\n  match: MatchState,\n  schoolId: SchoolId,\n  opponentSchoolId: SchoolId,\n): CpuCoachPublicView["publicStats"] {\n  const stats: CpuCoachPublicView["publicStats"] = {\n    ownAces: 0,\n    ownServeErrors: 0,\n    opponentAces: 0,\n    ownAttackPoints: 0,\n    opponentAttackPoints: 0,\n    ownBlockPoints: 0,\n    opponentBlockPoints: 0,\n  };\n\n  for (const event of match.eventLog) {\n    if (event.type !== "point") continue;\n    const ownPoint = event.winnerSchoolId === schoolId;\n    const opponentPoint = event.winnerSchoolId === opponentSchoolId;\n    if (event.detailCode === "point.serve-ace") {\n      if (ownPoint) stats.ownAces += 1;\n      if (opponentPoint) stats.opponentAces += 1;\n    } else if (event.detailCode === "point.serve-error") {\n      if (opponentPoint) stats.ownServeErrors += 1;\n    } else if (event.detailCode === "point.attack") {\n      if (ownPoint) stats.ownAttackPoints += 1;\n      if (opponentPoint) stats.opponentAttackPoints += 1;\n    } else if (event.detailCode === "point.block") {\n      if (ownPoint) stats.ownBlockPoints += 1;\n      if (opponentPoint) stats.opponentBlockPoints += 1;\n    }\n  }\n\n  return stats;\n}\n\nexport function buildCpuCoachPublicView(\n  state: GameState,\n  match: MatchState,\n  schoolId: SchoolId,\n): CpuCoachPublicView {\n  const runtime = match.runtime;\n  if (!runtime) {\n    throw new Error("cpu coach requires an interactive match runtime");\n  }\n  const school = state.schools[schoolId];\n  if (!school) {\n    throw new Error(`cpu coach school not found: ${schoolId}`);\n  }\n  const isHome = schoolId === match.homeSchoolId;\n  if (!isHome && schoolId !== match.awaySchoolId) {\n    throw new Error("cpu coach school must be part of the match");\n  }\n  const opponentSchoolId = isHome ? match.awaySchoolId : match.homeSchoolId;\n\n  return {\n    schoolId,\n    opponentSchoolId,\n    archetypeId: school.archetypeId,\n    reputation: school.reputation,\n    coachTactics: school.coach.tactics,\n    ownPlan: structuredClone(isHome ? runtime.homeTactics : runtime.awayTactics),\n    opponentPlan: structuredClone(\n      isHome ? runtime.awayTactics : runtime.homeTactics,\n    ),\n    score: {\n      own: isHome ? runtime.homeScore : runtime.awayScore,\n      opponent: isHome ? runtime.awayScore : runtime.homeScore,\n    },\n    setNumber: match.currentSetNumber,\n    ownSetsWon: isHome ? match.homeSetsWon : match.awaySetsWon,\n    opponentSetsWon: isHome ? match.awaySetsWon : match.homeSetsWon,\n    runLength: runtime.runLength,\n    runWinnerSchoolId: runtime.runWinnerSchoolId,\n    timeoutAvailable: !runtime.timeoutUsedSchoolIds.includes(schoolId),\n    publicStats: cpuPublicStats(match, schoolId, opponentSchoolId),\n  };\n}\n\nfunction pveCpuCoachPolicy(input: AutomaticCoachDecisionInput) {\n  return decideCpuCoachCommand(\n    buildCpuCoachPublicView(input.state, input.match, input.schoolId),\n    input.reason,\n  );\n}\n\nfunction consumeNextTrainingGrowthBoost''',
)

replace_once(
    path,
    '''      bestOfSets: 3,\n      random,\n      controlledSchoolId: state.userSchoolId,\n    });''',
    '''      bestOfSets: 3,\n      random,\n      controlledSchoolId: state.userSchoolId,\n      automaticCoachSchoolId: opponent.id,\n      automaticCoach: pveCpuCoachPolicy,\n    });''',
)

replace_once(
    path,
    '''    const simulation = resumeMatch({ state, match: commandedMatch });''',
    '''    const simulation = resumeMatch({\n      state,\n      match: commandedMatch,\n      automaticCoachSchoolId: opponentSchoolId,\n      automaticCoach: pveCpuCoachPolicy,\n    });''',
)

replace_once(
    path,
    '''      bestOfSets: 3,\n      random,\n      controlledSchoolId: state.userSchoolId,\n      dynamicsReadinessByPlayerId: buildPveDynamicsReadinessByPlayerId(state),\n    });''',
    '''      bestOfSets: 3,\n      random,\n      controlledSchoolId: state.userSchoolId,\n      automaticCoachSchoolId: context.schoolId,\n      automaticCoach: pveCpuCoachPolicy,\n      dynamicsReadinessByPlayerId: buildPveDynamicsReadinessByPlayerId(state),\n    });''',
)

replace_once(
    path,
    '''    const simulation = resumeMatch({\n      state: context.state,\n      match: commandedMatch,\n    });''',
    '''    const simulation = resumeMatch({\n      state: context.state,\n      match: commandedMatch,\n      automaticCoachSchoolId: context.schoolId,\n      automaticCoach: pveCpuCoachPolicy,\n    });''',
)
