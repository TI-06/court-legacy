from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")

# 1) Finish GameApp routing after the Phase 12 UI transform.
p = "src/app/GameApp.tsx"
t = read(p)
t = t.replace('import { TrainingScreen } from "../features/training/TrainingScreen";\n', "")
t = t.replace('import { TrainingScoutingEntry } from "../features/training/TrainingScoutingEntry";\n', "")
t = t.replace('type MoreView = "menu" | "school" | "shop";', 'type MoreView = "menu" | "shop";')
t = t.replace('if (tab !== "training") {', 'if (tab !== "school") {')

# Add the player-specific training mutator if the first transform did not persist it.
if "const changePlayerTraining" not in t:
    marker = '''  const saveTrainingPlan = async (plan: WeeklyPlan) => {\n    if (trainingCompleted) return;\n    await cloudSession.runAction(\n      { type: "set-training-plan", plan },\n      "練習設定を保存しています…",\n    );\n  };'''
    if marker not in t:
        raise SystemExit("saveTrainingPlan marker not found")
    addition = marker + '''\n\n  const changePlayerTraining = async (\n    playerId: PlayerId,\n    instructionId: string,\n  ) => {\n    const current = gameState.weeklySchedule.trainingPlan;\n    await saveTrainingPlan({\n      ...current,\n      individualAssignments: [\n        ...current.individualAssignments.filter(\n          (item) => item.playerId !== playerId,\n        ),\n        { playerId, instructionId },\n      ],\n    });\n  };'''
    t = t.replace(marker, addition, 1)

# Home props: old training shortcut becomes School and offer actions live on Home.
old_home = '''        onOpenTeam={() => setActiveTab("team")}\n        onOpenTraining={() => setActiveTab("training")}'''
new_home = '''        onOpenTeam={() => setActiveTab("team")}\n        onOpenSchool={() => setActiveTab("school")}\n        onAcceptPracticeOffer={() => void acceptPracticeOffer()}\n        onDeclinePracticeOffer={() => void declinePracticeOffer()}\n        operationPending={cloudSession.operation.status === "submitting"}'''
if old_home in t:
    t = t.replace(old_home, new_home, 1)

# Ensure Player hub receives the per-player training action.
old_player = '''        onChange={saveTeamSelection}\n        selection={teamSelection}'''
new_player = '''        onChange={saveTeamSelection}\n        onChangeTraining={changePlayerTraining}\n        trainingPending={cloudSession.operation.status === "submitting"}\n        selection={teamSelection}'''
if old_player in t:
    t = t.replace(old_player, new_player, 1)

# Replace the legacy Training tab branches with the School/Scouting destination.
legacy_start = '    ) : activeTab === "training" && scoutingOpen ? ('
legacy_end = '    ) : activeTab === "match" && officialTournamentView ? ('
if legacy_start in t:
    start = t.index(legacy_start)
    end = t.index(legacy_end, start)
    school_branch = '''    ) : activeTab === "school" && scoutingOpen ? (\n      <ScoutingScreen\n        error={scoutingError}\n        latestShopUseResult={latestShopUseResult}\n        loading={scoutingLoading}\n        onBack={() => {\n          setScoutingOpen(false);\n          setScoutingError(null);\n          setRetryRecruitCandidateId(null);\n        }}\n        onRecruit={(candidateId) => {\n          void recruitCandidate(candidateId);\n        }}\n        onRetry={retryScouting}\n        onUseShopItem={(itemId, target) => {\n          void consumeShopItemFromUi(itemId, target);\n        }}\n        recruitingCandidateId={recruitingCandidateId}\n        reports={scoutingReports}\n        shopPendingCandidateId={\n          shopPendingTarget?.type === "scouting-candidate"\n            ? shopPendingTarget.candidateId\n            : null\n        }\n        shopPendingItemId={shopPendingItemId}\n        shopStatus={shopStatus}\n        state={gameState}\n      />\n    ) : activeTab === "school" ? (\n      <SchoolScreen\n        onOpenScouting={openScouting}\n        onUpgradeFacility={upgradeSchoolFacility}\n        state={gameState}\n      />\n'''
    t = t[:start] + school_branch + t[end:]

# Remove the old nested school screen from More if it is still present.
more_school_start = '    ) : moreView === "school" ? ('
more_menu_start = '    ) : (\n      <MoreScreen'
if more_school_start in t:
    start = t.index(more_school_start)
    end = t.index(more_menu_start, start)
    t = t[:start] + t[end:]

# More no longer owns School navigation.
t = re.sub(r'\n\s*onOpenSchool=\{\(\) => setMoreView\("school"\)\}', '', t)

# No AppTab branch may refer to the removed training destination.
if 'activeTab === "training"' in t or 'setActiveTab("training")' in t or 'tab !== "training"' in t:
    raise SystemExit("legacy training tab routing remains in GameApp")
write(p, t)

# 2) Preserve old SchoolScreen tests while making scouting an optional callback prop.
p = "src/features/school/SchoolScreen.tsx"
t = read(p)
t = t.replace('  onOpenScouting: () => void;', '  onOpenScouting?: () => void;')
t = t.replace('id === "scouting" ? onOpenScouting() : setView(id)', 'id === "scouting" ? onOpenScouting?.() : setView(id)')
write(p, t)

# 3) Update the legacy MoreScreen unit test to the new bottom-tab architecture.
p = "tests/unit/features/more/MoreScreen.test.tsx"
write(p, '''import { fireEvent, render, screen } from "@testing-library/react";\nimport { vi } from "vitest";\nimport { MoreScreen } from "../../../../src/features/more/MoreScreen";\n\ndescribe("MoreScreen", () => {\n  it("keeps shop and account actions after School moves to the bottom navigation", () => {\n    const onOpenShop = vi.fn();\n    const onSignOut = vi.fn();\n\n    render(\n      <MoreScreen\n        accountLabel="coach@example.com"\n        onOpenShop={onOpenShop}\n        onSignOut={onSignOut}\n      />,\n    );\n\n    expect(screen.getByRole("heading", { name: "その他" })).toBeVisible();\n    expect(screen.getByText("管理メニュー")).toBeVisible();\n    expect(screen.getByText("coach@example.com")).toBeVisible();\n    expect(screen.queryByRole("button", { name: "学校管理" })).toBeNull();\n    expect(screen.getByRole("button", { name: "ショップ" })).toBeVisible();\n    expect(screen.getByRole("button", { name: "ログアウト" })).toBeVisible();\n\n    fireEvent.click(screen.getByRole("button", { name: "ショップ" }));\n    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));\n    expect(onOpenShop).toHaveBeenCalledTimes(1);\n    expect(onSignOut).toHaveBeenCalledTimes(1);\n  });\n});\n''')

# 4) Fix the two TDD fixture type errors without weakening production types.
p = "tests/unit/ui/OperationBlockingOverlay.test.tsx"
t = read(p)
t = t.replace('{status:"submitting",label:"練習設定を保存しています…"}', '{status:"submitting",label:"練習設定を保存しています…",operationId:"phase12-test"}')
write(p, t)

p = "tests/unit/ui/shell/phase12Navigation.test.ts"
t = read(p)
t = t.replace('APP_NAVIGATION.some((item)=>item.label==="育成")', 'APP_NAVIGATION.some((item)=>String(item.label)==="育成")')
write(p, t)

# 5) Remove a helper made obsolete when fatigue stopped driving weekly recovery.
p = "src/domain/calendar/weekProgression.ts"
t = read(p)
t = re.sub(r'\nfunction clamp\(value: number\): number \{\n  return Math\.max\(0, Math\.min\(100, Math\.round\(value\)\)\);\n\}\n', '\n', t, count=1)
write(p, t)
