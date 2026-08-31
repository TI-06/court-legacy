from pathlib import Path

path = Path("src/app/GameApp.tsx")
text = path.read_text()

old_import = '''import type {
  TrainingResult,
  WeeklyPlan,
} from "../domain/training/resolveWeeklyTraining";'''
new_import = 'import type { WeeklyPlan } from "../domain/training/resolveWeeklyTraining";'
assert text.count(old_import) == 1
text = text.replace(old_import, new_import, 1)

training_outcome = "  trainingResult?: TrainingResult;\n"
assert text.count(training_outcome) == 1
text = text.replace(training_outcome, "", 1)

state_block = '''  const [latestTrainingResult, setLatestTrainingResult] =
    useState<TrainingResult | null>(null);
'''
assert text.count(state_block) == 1
text = text.replace(state_block, "", 1)

result_assignment = "    setLatestTrainingResult(outcome?.trainingResult ?? null);\n"
assert text.count(result_assignment) == 1
text = text.replace(result_assignment, "", 1)

advance_anchor = "  const advanceWeek = async () => {\n"
mark_read = '''  const markNotificationRead = async (notificationId: string) => {
    await cloudSession.runAction(
      { type: "mark-notification-read", notificationId },
      "お知らせを更新しています…",
    );
  };

'''
assert text.count(advance_anchor) == 1
text = text.replace(advance_anchor, mark_read + advance_anchor, 1)

home_anchor = "        onAdvanceWeek={advanceWeek}\n"
assert text.count(home_anchor) == 1
text = text.replace(
    home_anchor,
    home_anchor + "        onMarkNotificationRead={markNotificationRead}\n",
    1,
)

result_prop = "          latestResult={latestTrainingResult}\n"
assert text.count(result_prop) == 1
text = text.replace(result_prop, "          latestResult={null}\n", 1)

path.write_text(text)
