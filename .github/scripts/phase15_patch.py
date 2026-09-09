from pathlib import Path

BRANCH_FILES = {
    "worker/game/actionSchema.ts": Path("worker/game/actionSchema.ts"),
    "worker/game/applyGameAction.ts": Path("worker/game/applyGameAction.ts"),
    "src/domain/match/simulateMatch.ts": Path("src/domain/match/simulateMatch.ts"),
}


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"patch anchor missing: {label}")
    return text.replace(old, new, 1)


def patch_action_schema() -> None:
    path = BRANCH_FILES["worker/game/actionSchema.ts"]
    text = path.read_text(encoding="utf-8")

    text = replace_once(
        text,
        'import type { FacilityKey } from "../../src/domain/school/facilityUpgrade";\n',
        'import type { FacilityKey } from "../../src/domain/school/facilityUpgrade";\nimport type { MatchTacticPlan } from "../../src/domain/team/matchTactics";\n',
        "action schema tactics import",
    )

    text = replace_once(
        text,
        'const savedLineupNameSchema = z\n  .string()\n  .transform((value) => value.trim())\n  .pipe(z.string().min(1).max(24));\n',
        'const savedLineupNameSchema = z\n  .string()\n  .transform((value) => value.trim())\n  .pipe(z.string().min(1).max(24));\n\nconst matchTacticPlanSchema = z\n  .object({\n    serve: z.enum(["safe", "balanced", "aggressive"]),\n    attack: z.enum(["side", "balanced", "quick"]),\n    block: z.enum(["commit", "mixed", "read"]),\n  })\n  .strict();\n',
        "action schema tactics zod",
    )

    text = replace_once(
        text,
        '  z\n    .object({\n      type: z.literal("team-selection"),\n      selection: teamSelectionSchema,\n    })\n    .strict(),\n',
        '  z\n    .object({\n      type: z.literal("team-selection"),\n      selection: teamSelectionSchema,\n    })\n    .strict(),\n  z\n    .object({\n      type: z.literal("set-team-tactics"),\n      plan: matchTacticPlanSchema,\n    })\n    .strict(),\n',
        "action schema tactics action",
    )

    text = replace_once(
        text,
        '  | { type: "team-selection"; selection: TeamSelection }\n',
        '  | { type: "team-selection"; selection: TeamSelection }\n  | { type: "set-team-tactics"; plan: MatchTacticPlan }\n',
        "action schema tactics union",
    )

    path.write_text(text, encoding="utf-8")


def patch_apply_game_action() -> None:
    path = BRANCH_FILES["worker/game/applyGameAction.ts"]
    text = path.read_text(encoding="utf-8")

    text = replace_once(
        text,
        'import { autoSelectTeam } from "../../src/domain/team/autoSelectTeam";\n',
        'import { autoSelectTeam } from "../../src/domain/team/autoSelectTeam";\nimport { applyMatchTacticPlan } from "../../src/domain/team/matchTactics";\n',
        "apply action tactics import",
    )

    anchor = '''function applyTeamSelection(\n  state: GameState,\n  action: Extract<GameAction, { type: "team-selection" }>,\n): AppliedGameAction {\n  const selection = cloneTeamSelection(action.selection);\n  const issues = validateTeamSelection({\n    state,\n    schoolId: state.userSchoolId,\n    selection,\n  });\n  if (issues.length > 0) {\n    return conflict("invalid_team_selection", issues[0]!.message);\n  }\n\n  return { state, teamSelection: selection };\n}\n'''
    addition = anchor + '''\nfunction applyTeamTactics(\n  state: GameState,\n  teamSelection: TeamSelection,\n  action: Extract<GameAction, { type: "set-team-tactics" }>,\n): AppliedGameAction {\n  const school = state.schools[state.userSchoolId];\n  if (!school) {\n    return conflict("user_school_not_found", "自校の戦術を更新できません");\n  }\n\n  return {\n    state: {\n      ...state,\n      schools: {\n        ...state.schools,\n        [school.id]: {\n          ...school,\n          tactics: applyMatchTacticPlan(school.tactics, action.plan),\n        },\n      },\n    },\n    teamSelection,\n  };\n}\n'''
    text = replace_once(text, anchor, addition, "apply action tactics handler")

    text = replace_once(
        text,
        '    case "team-selection":\n      return applyTeamSelection(state, action);\n',
        '    case "team-selection":\n      return applyTeamSelection(state, action);\n    case "set-team-tactics":\n      return applyTeamTactics(state, teamSelection, action);\n',
        "apply action tactics switch",
    )

    path.write_text(text, encoding="utf-8")


def patch_simulate_match() -> None:
    path = BRANCH_FILES["src/domain/match/simulateMatch.ts"]
    text = path.read_text(encoding="utf-8")

    text = replace_once(
        text,
        'import { validateTeamSelection } from "../team/validateTeamSelection";\n',
        'import {\n  deriveMatchTacticPlan,\n  getAttackBlockMatchupPoints,\n  type ServePlan,\n} from "../team/matchTactics";\nimport { validateTeamSelection } from "../team/validateTeamSelection";\n',
        "simulator tactics import",
    )

    old_strength = '''function serveStrength(server: Player, school: School): number {\n  return (\n    effectiveAbility(server, "serve") * 0.72 +\n    effectiveAbility(server, "mental") * 0.18 +\n    school.coach.tactics * 0.1 +\n    school.tactics.serveRisk * 0.12\n  );\n}\n'''
    new_strength = '''function serveStrength(server: Player, school: School): number {\n  return (\n    effectiveAbility(server, "serve") * 0.72 +\n    effectiveAbility(server, "mental") * 0.18 +\n    school.coach.tactics * 0.1\n  );\n}\n\ninterface ServeTacticProfile {\n  errorChance: number;\n  aceChance: number;\n  receiveQuality: number;\n}\n\nconst SERVE_TACTIC_PROFILE: Record<ServePlan, ServeTacticProfile> = {\n  safe: { errorChance: -0.016, aceChance: -0.012, receiveQuality: 2 },\n  balanced: { errorChance: 0, aceChance: 0, receiveQuality: 0 },\n  aggressive: { errorChance: 0.022, aceChance: 0.018, receiveQuality: -4 },\n};\n'''
    text = replace_once(text, old_strength, new_strength, "serve strength/profile")

    old_bonuses = '''function blockSystemBonus(school: School): number {\n  switch (school.tactics.blockSystem) {\n    case "commit":\n      return 4;\n    case "read":\n      return 7;\n    case "mixed":\n      return 5.5;\n  }\n}\n\nfunction defenseBiasBonus(school: School): number {\n  return school.tactics.defenseBias === "balanced" ? 5 : 3;\n}\n'''
    new_bonuses = '''function blockMatchupAdjustment(\n  attackingSchool: School,\n  defendingSchool: School,\n): number {\n  const attackPlan = deriveMatchTacticPlan(attackingSchool.tactics).attack;\n  const blockPlan = deriveMatchTacticPlan(defendingSchool.tactics).block;\n  return -getAttackBlockMatchupPoints(attackPlan, blockPlan);\n}\n'''
    text = replace_once(text, old_bonuses, new_bonuses, "block and defense flat bonuses")

    old_serve_setup = '''  const serverStrength = serveStrength(server, serving.school);\n  const receiverStrength = receiveStrength(receiver, receiving.school);\n  const serveErrorChance = clamp(\n    0.024 +\n      serving.school.tactics.serveRisk * 0.00105 -\n      serverStrength * 0.00024,\n    0.012,\n    0.17,\n  );\n'''
    new_serve_setup = '''  const serverStrength = serveStrength(server, serving.school);\n  const receiverStrength = receiveStrength(receiver, receiving.school);\n  const servePlan = deriveMatchTacticPlan(serving.school.tactics).serve;\n  const serveProfile = SERVE_TACTIC_PROFILE[servePlan];\n  const serveErrorChance = clamp(\n    0.024 + 50 * 0.00105 - serverStrength * 0.00024 + serveProfile.errorChance,\n    0.012,\n    0.17,\n  );\n'''
    text = replace_once(text, old_serve_setup, new_serve_setup, "serve error profile")

    old_ace = '''  const aceChance = clamp(\n    0.024 +\n      (serverStrength - receiverStrength) * 0.00205 +\n      serving.school.tactics.serveRisk * 0.00065,\n    0.01,\n    0.25,\n  );\n'''
    new_ace = '''  const aceChance = clamp(\n    0.024 +\n      (serverStrength - receiverStrength) * 0.00205 +\n      50 * 0.00065 +\n      serveProfile.aceChance,\n    0.01,\n    0.25,\n  );\n'''
    text = replace_once(text, old_ace, new_ace, "serve ace profile")

    text = replace_once(
        text,
        '  const receiveQuality = receiverStrength + receiveVariation;\n',
        '  const receiveQuality =\n    receiverStrength + serveProfile.receiveQuality + receiveVariation;\n',
        "receive quality profile",
    )

    old_powers = '''  const blockPower =\n    effectiveAbility(blocker, "block") * 0.62 +\n    effectiveAbility(blocker, "jump") * 0.24 +\n    effectiveAbility(blocker, "decision") * 0.14 +\n    serving.school.coach.tactics * 0.08 +\n    blockSystemBonus(serving.school);\n  const digPower =\n    effectiveAbility(digger, "receive") * 0.58 +\n    effectiveAbility(digger, "speed") * 0.25 +\n    effectiveAbility(digger, "decision") * 0.17 +\n    serving.school.coach.leadership * 0.07 +\n    defenseBiasBonus(serving.school);\n'''
    new_powers = '''  const blockPower =\n    effectiveAbility(blocker, "block") * 0.62 +\n    effectiveAbility(blocker, "jump") * 0.24 +\n    effectiveAbility(blocker, "decision") * 0.14 +\n    serving.school.coach.tactics * 0.08 +\n    blockMatchupAdjustment(receiving.school, serving.school);\n  const digPower =\n    effectiveAbility(digger, "receive") * 0.58 +\n    effectiveAbility(digger, "speed") * 0.25 +\n    effectiveAbility(digger, "decision") * 0.17 +\n    serving.school.coach.leadership * 0.07;\n'''
    text = replace_once(text, old_powers, new_powers, "matchup and defense power")

    path.write_text(text, encoding="utf-8")


patch_action_schema()
patch_apply_game_action()
patch_simulate_match()
