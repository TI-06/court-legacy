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
    'import type { School } from "../model/School";',
    'import type { School, TeamTactics } from "../model/School";',
)

replace_once(
    "src/domain/match/simulateMatch.ts",
    '''const ATTACK_POSITIONS: readonly Position[] = ["OH", "MB", "OP", "S"];\nconst MAX_RALLIES_PER_SET = 2_000;''',
    '''const ATTACK_POSITIONS: readonly Position[] = ["OH", "MB", "OP", "S"];\nconst MAX_RALLIES_PER_SET = 2_000;\n\nexport type AttackDirection = "line" | "cross" | "neutral";\n\nexport function getDefenseDirectionAdjustment(\n  defenseBias: TeamTactics["defenseBias"],\n  attackDirection: AttackDirection,\n): number {\n  if (defenseBias === "balanced" || attackDirection === "neutral") {\n    return 0;\n  }\n  return defenseBias === attackDirection ? 3 : -3;\n}''',
)

replace_once(
    "src/domain/match/simulateMatch.ts",
    '''function blockMatchupAdjustment(\n  attackingSchool: School,\n  defendingSchool: School,\n): number {\n  const attackPlan = deriveMatchTacticPlan(attackingSchool.tactics).attack;\n  const blockPlan = deriveMatchTacticPlan(defendingSchool.tactics).block;\n  return -getAttackBlockMatchupPoints(attackPlan, blockPlan);\n}\n\nfunction simulateRally(''',
    '''function blockMatchupAdjustment(\n  attackingSchool: School,\n  defendingSchool: School,\n): number {\n  const attackPlan = deriveMatchTacticPlan(attackingSchool.tactics).attack;\n  const blockPlan = deriveMatchTacticPlan(defendingSchool.tactics).block;\n  return -getAttackBlockMatchupPoints(attackPlan, blockPlan);\n}\n\nfunction chooseAttackDirection(\n  attacker: Player,\n  attackingSchool: School,\n  variationRoll: number,\n  abilityContext?: AbilityContext,\n): AttackDirection {\n  if (attacker.preferredPosition === "MB") {\n    const neutralChance = attackingSchool.tactics.attackTempo === "fast" ? 0.72 : 0.58;\n    if (variationRoll < neutralChance) return "neutral";\n    return variationRoll < neutralChance + (1 - neutralChance) / 2\n      ? "line"\n      : "cross";\n  }\n\n  const decision = effectiveAbility(attacker, "decision", abilityContext);\n  const neutralChance = attacker.preferredPosition === "S" ? 0.28 : 0.08;\n  const lineChance = clamp(0.3 + (decision - 50) * 0.0012, 0.24, 0.36);\n  if (variationRoll < neutralChance) return "neutral";\n  return variationRoll < neutralChance + lineChance ? "line" : "cross";\n}\n\nfunction simulateRally(''',
)

replace_once(
    "src/domain/match/simulateMatch.ts",
    '''  const attackPower =\n    effectiveAbility(attacker, "spike", abilityContext) * 0.58 +\n    effectiveAbility(attacker, "jump", abilityContext) * 0.19 +\n    effectiveAbility(attacker, "decision", abilityContext) * 0.11 +\n    attacker.positionAptitudes[attacker.preferredPosition] * 0.12 +\n    setQuality * 0.35 +\n    receiving.school.coach.tactics * 0.07 +\n    (random.next() - 0.5) * 16;\n  const blocker = chooseBlocker(state, serving.selection, abilityContext);''',
    '''  const attackVariationRoll = random.next();\n  const attackDirection = chooseAttackDirection(\n    attacker,\n    receiving.school,\n    attackVariationRoll,\n    abilityContext,\n  );\n  const attackPower =\n    effectiveAbility(attacker, "spike", abilityContext) * 0.58 +\n    effectiveAbility(attacker, "jump", abilityContext) * 0.19 +\n    effectiveAbility(attacker, "decision", abilityContext) * 0.11 +\n    attacker.positionAptitudes[attacker.preferredPosition] * 0.12 +\n    setQuality * 0.35 +\n    receiving.school.coach.tactics * 0.07 +\n    (attackVariationRoll - 0.5) * 16;\n  const blocker = chooseBlocker(state, serving.selection, abilityContext);''',
)

replace_once(
    "src/domain/match/simulateMatch.ts",
    '''  const digPower =\n    effectiveAbility(digger, "receive", abilityContext) * 0.58 +\n    effectiveAbility(digger, "speed", abilityContext) * 0.25 +\n    effectiveAbility(digger, "decision", abilityContext) * 0.17 +\n    serving.school.coach.leadership * 0.07;''',
    '''  const digPower =\n    effectiveAbility(digger, "receive", abilityContext) * 0.58 +\n    effectiveAbility(digger, "speed", abilityContext) * 0.25 +\n    effectiveAbility(digger, "decision", abilityContext) * 0.17 +\n    serving.school.coach.leadership * 0.07 +\n    getDefenseDirectionAdjustment(\n      serving.school.tactics.defenseBias,\n      attackDirection,\n    );''',
)

replace_once(
    "src/domain/match/simulateMatch.ts",
    '''    `attack.${attacker.preferredPosition.toLowerCase()}`,\n  );''',
    '''    `attack.${attacker.preferredPosition.toLowerCase()}.${attackDirection}`,\n  );''',
)

replace_once(
    "tests/unit/domain/match/phase15TacticalTradeoffs.test.ts",
    '''  it("does not give defenseBias a hidden flat simulation bonus", () => {\n    for (let index = 0; index < 8; index += 1) {\n      const seed = `defense-bias-${index}`;\n      const line = run(seed, balanced, balanced, "line");\n      const balancedBias = run(seed, balanced, balanced, "balanced");\n      expect(line.match).toEqual(balancedBias.match);\n      expect(line.analysis).toEqual(balancedBias.analysis);\n    }\n  });''',
    '''  it("makes defenseBias a real matchup axis without adding a flat team bonus", () => {\n    let changedMatches = 0;\n    for (let index = 0; index < 12; index += 1) {\n      const seed = `defense-bias-${index}`;\n      const line = run(seed, balanced, balanced, "line");\n      const cross = run(seed, balanced, balanced, "cross");\n      const balancedBias = run(seed, balanced, balanced, "balanced");\n\n      if (\n        JSON.stringify(line.match.eventLog) !==\n          JSON.stringify(cross.match.eventLog) ||\n        JSON.stringify(line.match.eventLog) !==\n          JSON.stringify(balancedBias.match.eventLog)\n      ) {\n        changedMatches += 1;\n      }\n    }\n    expect(changedMatches).toBeGreaterThan(0);\n  });''',
)
