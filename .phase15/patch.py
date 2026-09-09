from pathlib import Path


def write_if_changed(path: str, text: str) -> None:
    file_path = Path(path)
    current = file_path.read_text(encoding="utf-8")
    if current != text:
        file_path.write_text(text, encoding="utf-8")


def normalize_duplicate(path: str, duplicate: str, single: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    while duplicate in text:
        text = text.replace(duplicate, single, 1)
    write_if_changed(path, text)


def ensure_replace(path: str, marker: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    if marker in text:
        return
    if old not in text:
        raise RuntimeError(f"expected source not found in {path}: {old[:80]!r}")
    write_if_changed(path, text.replace(old, new, 1))


TACTICS_BRANCH = '''  if (mode === "tactics") {
    return (
      <main className="app-content player-hub">
        <HubTabs mode={mode} onChange={setMode} />
        <TeamTacticsPanel
          currentPlan={deriveMatchTacticPlan(school.tactics)}
          onSave={(plan) => void onSetTeamTactics?.(plan)}
          pending={tacticsPending}
        />
      </main>
    );
  }

'''

normalize_duplicate(
    "src/features/team/PlayerHubScreen.tsx",
    'import { TeamTacticsPanel } from "./TeamTacticsPanel";\nimport { TeamTacticsPanel } from "./TeamTacticsPanel";\n',
    'import { TeamTacticsPanel } from "./TeamTacticsPanel";\n',
)
normalize_duplicate(
    "src/features/team/PlayerHubScreen.tsx",
    TACTICS_BRANCH + TACTICS_BRANCH,
    TACTICS_BRANCH,
)

ensure_replace(
    "src/features/team/PlayerHubScreen.tsx",
    'from "../../domain/team/matchTactics";',
    'import type { PlayerId } from "../../domain/model/identifiers";\nimport type { SavedLineupSlot } from "../../domain/team/teamPlanningTypes";',
    'import type { PlayerId } from "../../domain/model/identifiers";\nimport {\n  deriveMatchTacticPlan,\n  type MatchTacticPlan,\n} from "../../domain/team/matchTactics";\nimport type { SavedLineupSlot } from "../../domain/team/teamPlanningTypes";',
)
ensure_replace(
    "src/features/team/PlayerHubScreen.tsx",
    'import { TeamTacticsPanel } from "./TeamTacticsPanel";',
    'import { TeamDynamicsPanel } from "./TeamDynamicsPanel";\nimport { TeamScreen } from "./TeamScreen";',
    'import { TeamDynamicsPanel } from "./TeamDynamicsPanel";\nimport { TeamScreen } from "./TeamScreen";\nimport { TeamTacticsPanel } from "./TeamTacticsPanel";',
)
ensure_replace(
    "src/features/team/PlayerHubScreen.tsx",
    "  tacticsPending?: boolean;",
    '  planningPending?: boolean;\n  onChangeTraining?: (',
    '  planningPending?: boolean;\n  tacticsPending?: boolean;\n  onChangeTraining?: (',
)
ensure_replace(
    "src/features/team/PlayerHubScreen.tsx",
    "  onSetTeamTactics?: (plan: MatchTacticPlan) => void | Promise<void>;",
    '  onSetDevelopmentPriorities?: (playerIds: PlayerId[]) => void | Promise<void>;\n  onSaveLineupPreset?: (',
    '  onSetDevelopmentPriorities?: (playerIds: PlayerId[]) => void | Promise<void>;\n  onSetTeamTactics?: (plan: MatchTacticPlan) => void | Promise<void>;\n  onSaveLineupPreset?: (',
)
ensure_replace(
    "src/features/team/PlayerHubScreen.tsx",
    '| "tactics";',
    'type HubMode = "roster" | "lineup" | "dynamics";',
    'type HubMode = "roster" | "lineup" | "dynamics" | "tactics";',
)
ensure_replace(
    "src/features/team/PlayerHubScreen.tsx",
    '["tactics", "戦術"],',
    '          ["dynamics", "チーム状態"],\n        ] as const',
    '          ["dynamics", "チーム状態"],\n          ["tactics", "戦術"],\n        ] as const',
)
ensure_replace(
    "src/features/team/PlayerHubScreen.tsx",
    "  tacticsPending = false,",
    '  planningPending = false,\n  onChangeTraining,\n  onSetDevelopmentPriorities,',
    '  planningPending = false,\n  tacticsPending = false,\n  onChangeTraining,\n  onSetDevelopmentPriorities,\n  onSetTeamTactics,',
)
ensure_replace(
    "src/features/team/PlayerHubScreen.tsx",
    '  if (mode === "tactics") {',
    '  if (selectedPlayer) {\n',
    TACTICS_BRANCH + '  if (selectedPlayer) {\n',
)
ensure_replace(
    "src/features/team/player-hub.css",
    "grid-template-columns: repeat(4, minmax(0, 1fr));",
    "  grid-template-columns: repeat(3, minmax(0, 1fr));",
    "  grid-template-columns: repeat(4, minmax(0, 1fr));",
)
