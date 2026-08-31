from pathlib import Path

path = Path("src/app/GameApp.tsx")
source = path.read_text()
old = '''      <div className="training-hub-screen">
        <TrainingScoutingEntry onOpen={openScouting} state={gameState} />
        <TrainingScreen
          completed={trainingCompleted}
          data={gameData}
          latestResult={null}
          onSave={saveTrainingPlan}
          state={gameState}
        />
      </div>'''
new = '''      <div className="training-hub-screen">
        <TrainingScreen
          completed={trainingCompleted}
          data={gameData}
          onSave={saveTrainingPlan}
          state={gameState}
        />
        <TrainingScoutingEntry onOpen={openScouting} state={gameState} />
      </div>'''
if source.count(old) != 1:
    raise SystemExit("training hub anchor mismatch")
path.write_text(source.replace(old, new, 1))
