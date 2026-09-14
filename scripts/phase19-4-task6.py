from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected marker once, found {count}: {old[:140]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# Worker action contract stays separate from MatchTacticPlan/PvP transport.
replace_once(
    "worker/game/actionSchema.ts",
    '''  z\n    .object({\n      type: z.literal("set-team-tactics"),\n      plan: matchTacticPlanSchema,\n    })\n    .strict(),\n  z\n    .object({\n      type: z.literal("set-team-leadership"),''',
    '''  z\n    .object({\n      type: z.literal("set-team-tactics"),\n      plan: matchTacticPlanSchema,\n    })\n    .strict(),\n  z\n    .object({\n      type: z.literal("set-team-defense-bias"),\n      defenseBias: z.enum(["line", "balanced", "cross"]),\n    })\n    .strict(),\n  z\n    .object({\n      type: z.literal("set-team-leadership"),''',
)
replace_once(
    "worker/game/actionSchema.ts",
    '''  | { type: "team-selection"; selection: TeamSelection }\n  | { type: "set-team-tactics"; plan: MatchTacticPlan }\n  | {\n      type: "set-team-leadership";''',
    '''  | { type: "team-selection"; selection: TeamSelection }\n  | { type: "set-team-tactics"; plan: MatchTacticPlan }\n  | {\n      type: "set-team-defense-bias";\n      defenseBias: "line" | "balanced" | "cross";\n    }\n  | {\n      type: "set-team-leadership";''',
)

replace_once(
    "worker/game/applyGameAction.ts",
    '''function applyTeamLeadership(\n  state: GameState,''',
    '''function applyTeamDefenseBias(\n  state: GameState,\n  teamSelection: TeamSelection,\n  action: Extract<GameAction, { type: "set-team-defense-bias" }>,\n): AppliedGameAction {\n  const school = state.schools[state.userSchoolId];\n  if (!school) {\n    return conflict("user_school_not_found", "自校の守備配置を更新できません");\n  }\n\n  return {\n    state: {\n      ...state,\n      schools: {\n        ...state.schools,\n        [school.id]: {\n          ...school,\n          tactics: {\n            ...school.tactics,\n            defenseBias: action.defenseBias,\n          },\n        },\n      },\n    },\n    teamSelection,\n  };\n}\n\nfunction applyTeamLeadership(\n  state: GameState,''',
)
replace_once(
    "worker/game/applyGameAction.ts",
    '''    case "set-team-tactics":\n      return applyTeamTactics(state, teamSelection, action);\n    case "set-team-leadership":''',
    '''    case "set-team-tactics":\n      return applyTeamTactics(state, teamSelection, action);\n    case "set-team-defense-bias":\n      return applyTeamDefenseBias(state, teamSelection, action);\n    case "set-team-leadership":''',
)

replace_once(
    "src/features/team/tacticsPresentation.ts",
    '''import type {\n  AttackPlan,''',
    '''import type { TeamTactics } from "../../domain/model/School";\nimport type {\n  AttackPlan,''',
)
replace_once(
    "src/features/team/tacticsPresentation.ts",
    '''export interface TacticOption<Value extends string> {''',
    '''export type DefenseBias = TeamTactics["defenseBias"];\n\nexport interface TacticOption<Value extends string> {''',
)
replace_once(
    "src/features/team/tacticsPresentation.ts",
    '''export const blockTacticOptions: readonly TacticOption<BlockPlan>[] = [''',
    '''export const defenseBiasOptions: readonly TacticOption<DefenseBias>[] = [\n  {\n    value: "line",\n    label: "ライン警戒",\n    description: "ストレートを厚く守り、クロス側の空間と引き換えに止める",\n  },\n  {\n    value: "balanced",\n    label: "バランス",\n    description: "ラインとクロスを均等に守り、大きな読み外しを避ける",\n  },\n  {\n    value: "cross",\n    label: "クロス警戒",\n    description: "クロスを厚く守り、ライン側の空間と引き換えに止める",\n  },\n];\n\nexport const blockTacticOptions: readonly TacticOption<BlockPlan>[] = [''',
)

replace_once(
    "src/features/team/TeamTacticsPanel.tsx",
    '''  attackTacticOptions,\n  blockTacticOptions,\n  serveTacticOptions,\n  type TacticOption,''',
    '''  attackTacticOptions,\n  blockTacticOptions,\n  defenseBiasOptions,\n  serveTacticOptions,\n  type DefenseBias,\n  type TacticOption,''',
)
replace_once(
    "src/features/team/TeamTacticsPanel.tsx",
    '''export interface TeamTacticsPanelProps {\n  currentPlan: MatchTacticPlan;\n  pending: boolean;\n  onSave: (plan: MatchTacticPlan) => void;\n}''',
    '''export interface TeamTacticsPanelProps {\n  currentPlan: MatchTacticPlan;\n  currentDefenseBias: DefenseBias;\n  pending: boolean;\n  onSave: (plan: MatchTacticPlan) => void;\n  onSaveDefenseBias: (defenseBias: DefenseBias) => void;\n}''',
)
replace_once(
    "src/features/team/TeamTacticsPanel.tsx",
    '''interface DraftState {\n  baseKey: string;\n  plan: MatchTacticPlan;\n}''',
    '''interface DraftState {\n  baseKey: string;\n  plan: MatchTacticPlan;\n}\n\ninterface DefenseDraftState {\n  baseValue: DefenseBias;\n  value: DefenseBias;\n}''',
)
replace_once(
    "src/features/team/TeamTacticsPanel.tsx",
    '''export function TeamTacticsPanel({\n  currentPlan,\n  pending,\n  onSave,\n}: TeamTacticsPanelProps) {\n  const [draftState, setDraftState] = useState<DraftState | null>(null);''',
    '''export function TeamTacticsPanel({\n  currentPlan,\n  currentDefenseBias,\n  pending,\n  onSave,\n  onSaveDefenseBias,\n}: TeamTacticsPanelProps) {\n  const [draftState, setDraftState] = useState<DraftState | null>(null);\n  const [defenseDraftState, setDefenseDraftState] =\n    useState<DefenseDraftState | null>(null);''',
)
replace_once(
    "src/features/team/TeamTacticsPanel.tsx",
    '''  const unchanged = useMemo(\n    () => samePlan(draft, currentPlan),\n    [currentPlan, draft],\n  );''',
    '''  const unchanged = useMemo(\n    () => samePlan(draft, currentPlan),\n    [currentPlan, draft],\n  );\n  const defenseDraft =\n    defenseDraftState?.baseValue === currentDefenseBias\n      ? defenseDraftState.value\n      : currentDefenseBias;\n  const defenseUnchanged = defenseDraft === currentDefenseBias;''',
)
replace_once(
    "src/features/team/TeamTacticsPanel.tsx",
    '''      <button\n        aria-label="基本戦術を保存"''',
    '''      <TacticChoiceGroup<DefenseBias>\n        label="守備配置"\n        onChange={(value) =>\n          setDefenseDraftState({ baseValue: currentDefenseBias, value })\n        }\n        options={defenseBiasOptions}\n        pending={pending}\n        value={defenseDraft}\n      />\n\n      <button\n        aria-label="守備配置を保存"\n        className="team-tactics__save"\n        disabled={pending || defenseUnchanged}\n        onClick={() => onSaveDefenseBias(defenseDraft)}\n        type="button"\n      >\n        {pending ? "守備配置を保存しています…" : "守備配置を保存"}\n      </button>\n\n      <button\n        aria-label="基本戦術を保存"''',
)

replace_once(
    "src/features/team/PlayerHubScreen.tsx",
    '''import type { Player } from "../../domain/model/Player";''',
    '''import type { Player } from "../../domain/model/Player";\nimport type { TeamTactics } from "../../domain/model/School";''',
)
replace_once(
    "src/features/team/PlayerHubScreen.tsx",
    '''  onSetTeamTactics?: (plan: MatchTacticPlan) => void | Promise<void>;\n  onSaveLineupPreset?:''',
    '''  onSetTeamTactics?: (plan: MatchTacticPlan) => void | Promise<void>;\n  onSetTeamDefenseBias?: (\n    defenseBias: TeamTactics["defenseBias"],\n  ) => void | Promise<void>;\n  onSaveLineupPreset?:''',
)
replace_once(
    "src/features/team/PlayerHubScreen.tsx",
    '''  onSetDevelopmentPriorities,\n  onSetTeamTactics,\n  onSaveLineupPreset,''',
    '''  onSetDevelopmentPriorities,\n  onSetTeamTactics,\n  onSetTeamDefenseBias,\n  onSaveLineupPreset,''',
)
replace_once(
    "src/features/team/PlayerHubScreen.tsx",
    '''        <TeamTacticsPanel\n          currentPlan={deriveMatchTacticPlan(school.tactics)}\n          onSave={(plan) => void onSetTeamTactics?.(plan)}\n          pending={tacticsPending}\n        />''',
    '''        <TeamTacticsPanel\n          currentDefenseBias={school.tactics.defenseBias}\n          currentPlan={deriveMatchTacticPlan(school.tactics)}\n          onSave={(plan) => void onSetTeamTactics?.(plan)}\n          onSaveDefenseBias={(defenseBias) =>\n            void onSetTeamDefenseBias?.(defenseBias)\n          }\n          pending={tacticsPending}\n        />''',
)

replace_once(
    "src/app/GameApp.tsx",
    '''import type { SchoolReputation } from "../domain/model/School";''',
    '''import type { SchoolReputation, TeamTactics } from "../domain/model/School";''',
)
replace_once(
    "src/app/GameApp.tsx",
    '''  const saveLineupPreset = async (\n    slot: SavedLineupSlot,''',
    '''  const saveTeamDefenseBias = async (\n    defenseBias: TeamTactics["defenseBias"],\n  ) => {\n    await cloudSession.runAction(\n      { type: "set-team-defense-bias", defenseBias },\n      "守備配置を保存しています…",\n    );\n  };\n\n  const saveLineupPreset = async (\n    slot: SavedLineupSlot,''',
)
replace_once(
    "src/app/GameApp.tsx",
    '''        onSetDevelopmentPriorities={saveDevelopmentPriorities}\n        onSetTeamTactics={saveTeamTactics}\n        planningPending=''',
    '''        onSetDevelopmentPriorities={saveDevelopmentPriorities}\n        onSetTeamDefenseBias={saveTeamDefenseBias}\n        onSetTeamTactics={saveTeamTactics}\n        planningPending=''',
)
