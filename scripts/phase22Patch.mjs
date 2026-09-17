import { readFileSync, writeFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function write(path, text) {
  writeFileSync(path, text, "utf8");
}

function replaceOnce(path, oldText, newText) {
  const text = read(path);
  if (text.includes(newText)) return false;
  if (!text.includes(oldText)) {
    throw new Error(`expected source block not found: ${path}`);
  }
  write(path, text.replace(oldText, newText));
  return true;
}

function replaceAll(path, oldText, newText, expected) {
  const text = read(path);
  if (text.includes(newText) && !text.includes(oldText)) return false;
  const count = text.split(oldText).length - 1;
  if (count !== expected) {
    throw new Error(`expected ${expected} source blocks in ${path}, found ${count}`);
  }
  write(path, text.split(oldText).join(newText));
  return true;
}

function replaceBetween(path, startMarker, endMarker, replacement) {
  const text = read(path);
  if (text.includes(replacement)) return false;
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`expected marker range not found: ${path}`);
  }
  write(path, `${text.slice(0, start)}${replacement}\n\n${text.slice(end)}`);
  return true;
}

replaceOnce(
  "src/domain/model/Match.ts",
  '  | { type: "continue" };',
  '  | { type: "continue" }\n  | { type: "skip-to-result" };',
);

replaceOnce(
  "worker/game/actionSchema.ts",
  '  z.object({ type: z.literal("continue") }).strict(),\n]);',
  '  z.object({ type: z.literal("continue") }).strict(),\n  z.object({ type: z.literal("skip-to-result") }).strict(),\n]);',
);

replaceOnce(
  "src/domain/match/applyMatchCommand.ts",
  '  const historyEventSequence = match.eventLog.length;\n\n  switch (input.command.type) {',
  '  const historyEventSequence = match.eventLog.length;\n  const skipToResult = input.command.type === "skip-to-result";\n  const recordedCommand: MatchCommand = skipToResult\n    ? { type: "continue" }\n    : input.command;\n\n  switch (input.command.type) {',
);
replaceOnce(
  "src/domain/match/applyMatchCommand.ts",
  '    case "continue":\n      break;',
  '    case "continue":\n    case "skip-to-result":\n      break;',
);
replaceOnce(
  "src/domain/match/applyMatchCommand.ts",
  "    command: structuredClone(input.command),",
  "    command: structuredClone(recordedCommand),",
);
replaceOnce(
  "src/domain/match/applyMatchCommand.ts",
  '  match.pendingCoachCommandForSchoolId = null;\n  runtime.pendingDecisionReason = null;\n\n  return match;',
  '  match.pendingCoachCommandForSchoolId = null;\n  runtime.pendingDecisionReason = null;\n  if (skipToResult) {\n    runtime.controlledSchoolId = null;\n  }\n\n  return match;',
);

replaceOnce(
  "src/features/match/MatchScreen.tsx",
  '  const [speed, setSpeed] = useState<PlaybackSpeed>(1);\n  const result = presentation?.simulation ?? legacyResult;',
  '  const [speed, setSpeed] = useState<PlaybackSpeed>(1);\n  const [skipTargetMatchId, setSkipTargetMatchId] = useState<string | null>(null);\n  const result = presentation?.simulation ?? legacyResult;',
);
replaceOnce(
  "src/features/match/MatchScreen.tsx",
  "  const presentedEvents = useMemo(() => {",
  '  useEffect(() => {\n    if (\n      !result?.analysis ||\n      skipTargetMatchId !== String(result.match.id)\n    ) {\n      return;\n    }\n    setPlaying(false);\n    setVisibleEventIndex(lastEventIndex);\n    setSkipTargetMatchId(null);\n  }, [lastEventIndex, result, skipTargetMatchId]);\n\n  const presentedEvents = useMemo(() => {',
);
replaceOnce(
  "src/features/match/MatchScreen.tsx",
  '                {result.analysis ? "結果まで進む" : "次の判断まで進む"}\n              </button>\n            </div>',
  '                {result.analysis ? "ダイジェスト末尾へ" : "次の判断まで進む"}\n              </button>\n              <button\n                disabled={commandPending || (!result.analysis && !onCommand)}\n                onClick={() => {\n                  setPlaying(false);\n                  if (result.analysis) {\n                    setVisibleEventIndex(lastEventIndex);\n                    return;\n                  }\n                  if (!onCommand) return;\n                  setSkipTargetMatchId(String(result.match.id));\n                  void Promise.resolve(\n                    onCommand({ type: "skip-to-result" }),\n                  ).catch(() => setSkipTargetMatchId(null));\n                }}\n                type="button"\n              >\n                結果までスキップ\n              </button>\n            </div>',
);

replaceOnce(
  "src/features/home/HomeScreen.tsx",
  '  data?: Pick<GameDataRegistry, "trainingMenus">;',
  '  data?: Pick<\n    GameDataRegistry,\n    "trainingMenus" | "individualTrainingInstructions"\n  >;',
);
replaceAll(
  "src/features/home/homeCommandCenter.ts",
  'Pick<GameDataRegistry, "trainingMenus">',
  'Pick<\n    GameDataRegistry,\n    "trainingMenus" | "individualTrainingInstructions"\n  >',
  2,
);

const trainingReplacement = `  const trainingCompleted = isWeeklyActionCompleted(state, "training");
  const assignmentByPlayerId = new Map(
    state.weeklySchedule.trainingPlan.individualAssignments
      .filter((assignment) => school.playerIds.includes(assignment.playerId))
      .map((assignment) => [assignment.playerId, assignment.instructionId]),
  );
  const instructionCounts = new Map<
    string,
    { name: string; count: number }
  >();
  let configuredCount = 0;
  for (const playerId of school.playerIds) {
    const instructionId = assignmentByPlayerId.get(playerId);
    if (!instructionId) continue;
    const instruction = data.individualTrainingInstructions.get(instructionId);
    if (!instruction) continue;
    configuredCount += 1;
    const current = instructionCounts.get(instruction.id);
    instructionCounts.set(instruction.id, {
      name: instruction.name,
      count: (current?.count ?? 0) + 1,
    });
  }
  const unconfiguredCount = school.playerIds.length - configuredCount;
  const individualSummary = [...instructionCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, summary]) => \`\${summary.name} \${summary.count}名\`);
  if (unconfiguredCount > 0) {
    individualSummary.push(\`未設定 \${unconfiguredCount}名\`);
  }
  individualSummary.push(
    \`設定済み \${configuredCount}/\${school.playerIds.length}名\`,
  );
  const needsIndividualSetup = !trainingCompleted && unconfiguredCount > 0;
  candidates.push({
    order: 50,
    task: {
      id: "training:weekly",
      kind: "action",
      priority: trainingCompleted ? "complete" : "normal",
      category: "training",
      title: "個人練習",
      detail: trainingCompleted
        ? \`\${individualSummary.join("・")}・今週分完了 ✓\`
        : individualSummary.join("・"),
      action: needsIndividualSetup ? { target: "team" } : undefined,
      actionLabel: needsIndividualSetup ? "個人練習を設定" : undefined,
      complete: trainingCompleted,
    },
  });`;

replaceBetween(
  "src/features/home/homeCommandCenter.ts",
  '  const trainingCompleted = isWeeklyActionCompleted(state, "training");',
  "  const affordableFacilities = FACILITY_DEFINITIONS.filter(",
  trainingReplacement,
);

console.log("Phase22-2 patch applied");
