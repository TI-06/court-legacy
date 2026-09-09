from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    if old in text:
        file_path.write_text(text.replace(old, new, 1), encoding="utf-8")
        return
    if new in text:
        return
    raise RuntimeError(f"expected source not found in {path}: {old[:80]!r}")


replace_once(
    "src/features/team/PlayerHubScreen.tsx",
    'import type { PlayerId } from "../../domain/model/identifiers";\nimport type { SavedLineupSlot } from "../../domain/team/teamPlanningTypes";',
    'import type { PlayerId } from "../../domain/model/identifiers";\nimport {\n  deriveMatchTacticPlan,\n  type MatchTacticPlan,\n} from "../../domain/team/matchTactics";\nimport type { SavedLineupSlot } from "../../domain/team/teamPlanningTypes";',
)
replace_once(
    "src/features/team/PlayerHubScreen.tsx",
    'import { TeamDynamicsPanel } from "./TeamDynamicsPanel";\nimport { TeamScreen } from "./TeamScreen";',
    'import { TeamDynamicsPanel } from "./TeamDynamicsPanel";\nimport { TeamScreen } from "./TeamScreen";\nimport { TeamTacticsPanel } from "./TeamTacticsPanel";',
)
replace_once(
    "src/features/team/PlayerHubScreen.tsx",
    '  planningPending?: boolean;\n  onChangeTraining?: (',
    '  planningPending?: boolean;\n  tacticsPending?: boolean;\n  onChangeTraining?: (',
)
replace_once(
    "src/features/team/PlayerHubScreen.tsx",
    '  onSetDevelopmentPriorities?: (playerIds: PlayerId[]) => void | Promise<void>;\n  onSaveLineupPreset?: (',
    '  onSetDevelopmentPriorities?: (playerIds: PlayerId[]) => void | Promise<void>;\n  onSetTeamTactics?: (plan: MatchTacticPlan) => void | Promise<void>;\n  onSaveLineupPreset?: (',
)
replace_once(
    "src/features/team/PlayerHubScreen.tsx",
    'type HubMode = "roster" | "lineup" | "dynamics";',
    'type HubMode = "roster" | "lineup" | "dynamics" | "tactics";',
)
replace_once(
    "src/features/team/PlayerHubScreen.tsx",
    '          ["dynamics", "チーム状態"],\n        ] as const',
    '          ["dynamics", "チーム状態"],\n          ["tactics", "戦術"],\n        ] as const',
)
replace_once(
    "src/features/team/PlayerHubScreen.tsx",
    '  planningPending = false,\n  onChangeTraining,\n  onSetDevelopmentPriorities,',
    '  planningPending = false,\n  tacticsPending = false,\n  onChangeTraining,\n  onSetDevelopmentPriorities,\n  onSetTeamTactics,',
)
replace_once(
    "src/features/team/PlayerHubScreen.tsx",
    '  if (selectedPlayer) {\n',
    '  if (mode === "tactics") {\n    return (\n      <main className="app-content player-hub">\n        <HubTabs mode={mode} onChange={setMode} />\n        <TeamTacticsPanel\n          currentPlan={deriveMatchTacticPlan(school.tactics)}\n          onSave={(plan) => void onSetTeamTactics?.(plan)}\n          pending={tacticsPending}\n        />\n      </main>\n    );\n  }\n\n  if (selectedPlayer) {\n',
)
replace_once(
    "src/features/team/player-hub.css",
    "  grid-template-columns: repeat(3, minmax(0, 1fr));",
    "  grid-template-columns: repeat(4, minmax(0, 1fr));",
)
