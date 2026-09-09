from pathlib import Path

BRANCH_FILES = {
    "worker/game/actionSchema.ts": Path("worker/game/actionSchema.ts"),
    "worker/game/applyGameAction.ts": Path("worker/game/applyGameAction.ts"),
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


patch_action_schema()
patch_apply_game_action()
