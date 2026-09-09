from pathlib import Path


path = Path("src/app/GameApp.tsx")
text = path.read_text(encoding="utf-8")

if 'type MatchTacticPlan' not in text:
    old = 'import { autoSelectTeam } from "../domain/team/autoSelectTeam";\nimport type { SavedLineupSlot } from "../domain/team/teamPlanningTypes";'
    new = 'import { autoSelectTeam } from "../domain/team/autoSelectTeam";\nimport type { MatchTacticPlan } from "../domain/team/matchTactics";\nimport type { SavedLineupSlot } from "../domain/team/teamPlanningTypes";'
    if old not in text:
        raise RuntimeError("GameApp tactics import anchor not found")
    text = text.replace(old, new, 1)

if "const saveTeamTactics = async" not in text:
    old = '''  const saveDevelopmentPriorities = async (playerIds: PlayerId[]) => {
    await cloudSession.runAction(
      { type: "set-development-priorities", playerIds },
      "重点育成を保存しています…",
    );
  };
'''
    new = old + '''
  const saveTeamTactics = async (plan: MatchTacticPlan) => {
    await cloudSession.runAction(
      { type: "set-team-tactics", plan },
      "基本戦術を保存しています…",
    );
  };
'''
    if old not in text:
        raise RuntimeError("GameApp saveDevelopmentPriorities anchor not found")
    text = text.replace(old, new, 1)

if "onSetTeamTactics={saveTeamTactics}" not in text:
    old = '''        onSaveLineupPreset={saveLineupPreset}
        onSetDevelopmentPriorities={saveDevelopmentPriorities}
        planningPending={cloudSession.operation.status === "submitting"}
'''
    new = '''        onSaveLineupPreset={saveLineupPreset}
        onSetDevelopmentPriorities={saveDevelopmentPriorities}
        onSetTeamTactics={saveTeamTactics}
        planningPending={cloudSession.operation.status === "submitting"}
        tacticsPending={cloudSession.operation.status === "submitting"}
'''
    if old not in text:
        raise RuntimeError("GameApp PlayerHub props anchor not found")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
