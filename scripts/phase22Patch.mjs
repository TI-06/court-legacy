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
  "src/features/match/matchCommandPresentation.ts",
  '    case "continue":\n      return "このまま続ける";\n  }',
  '    case "continue":\n      return "このまま続ける";\n    case "skip-to-result":\n      return "結果までスキップ";\n  }',
);

replaceOnce(
  "src/features/match/MatchScreen.tsx",
  '  commandPending?: boolean;\n  schoolDisplayNames?: Partial<Record<School["id"], string>>;',
  '  commandPending?: boolean;\n  allowResultSkip?: boolean;\n  schoolDisplayNames?: Partial<Record<School["id"], string>>;',
);
replaceOnce(
  "src/features/match/MatchScreen.tsx",
  '  onCommand,\n  commandPending = false,\n  schoolDisplayNames,',
  '  onCommand,\n  commandPending = false,\n  allowResultSkip = false,\n  schoolDisplayNames,',
);
replaceOnce(
  "src/features/match/MatchScreen.tsx",
  '  const [speed, setSpeed] = useState<PlaybackSpeed>(1);\n  const result = presentation?.simulation ?? legacyResult;',
  '  const [speed, setSpeed] = useState<PlaybackSpeed>(1);\n  const [skipTargetMatchId, setSkipTargetMatchId] = useState<string | null>(null);\n  const result = presentation?.simulation ?? legacyResult;',
);
replaceOnce(
  "src/features/match/MatchScreen.tsx",
  '  const eventCount = result?.match.eventLog.length ?? 0;\n  const lastEventIndex = Math.max(0, eventCount - 1);\n  const segmentRevealed = visibleEventIndex >= lastEventIndex;',
  '  const eventCount = result?.match.eventLog.length ?? 0;\n  const lastEventIndex = Math.max(0, eventCount - 1);\n  const resultSkipResolved = Boolean(\n    result?.analysis && skipTargetMatchId === String(result.match.id),\n  );\n  const revealedEventIndex = resultSkipResolved\n    ? lastEventIndex\n    : visibleEventIndex;\n  const segmentRevealed = revealedEventIndex >= lastEventIndex;',
);
replaceOnce(
  "src/features/match/MatchScreen.tsx",
  '    return result.match.eventLog.slice(0, visibleEventIndex + 1).map((event) =>',
  '    return result.match.eventLog.slice(0, revealedEventIndex + 1).map((event) =>',
);
replaceOnce(
  "src/features/match/MatchScreen.tsx",
  '  }, [presentation, result, schoolDisplayNames, state, visibleEventIndex]);',
  '  }, [presentation, result, revealedEventIndex, schoolDisplayNames, state]);',
);
replaceOnce(
  "src/features/match/MatchScreen.tsx",
  '  const visibleRawEvents = result.match.eventLog.slice(\n    0,\n    visibleEventIndex + 1,\n  );',
  '  const visibleRawEvents = result.match.eventLog.slice(\n    0,\n    revealedEventIndex + 1,\n  );',
);
replaceOnce(
  "src/features/match/MatchScreen.tsx",
  '              {visibleEventIndex + 1} / {eventCount}',
  '              {revealedEventIndex + 1} / {eventCount}',
);
replaceOnce(
  "src/features/match/MatchScreen.tsx",
  '                第{result.match.eventLog[visibleEventIndex]!.setNumber}セット',
  '                第{result.match.eventLog[revealedEventIndex]!.setNumber}セット',
);
replaceOnce(
  "src/features/match/MatchScreen.tsx",
  '                disabled={visibleEventIndex >= lastEventIndex}',
  '                disabled={revealedEventIndex >= lastEventIndex}',
);
replaceOnce(
  "src/features/match/MatchScreen.tsx",
  '                {result.analysis ? "結果まで進む" : "次の判断まで進む"}\n              </button>\n            </div>',
  '                {result.analysis ? "ダイジェスト末尾へ" : "次の判断まで進む"}\n              </button>\n              {allowResultSkip ? (\n                <button\n                  disabled={commandPending || (!result.analysis && !onCommand)}\n                  onClick={() => {\n                    setPlaying(false);\n                    if (result.analysis) {\n                      setVisibleEventIndex(lastEventIndex);\n                      return;\n                    }\n                    if (!onCommand) return;\n                    setSkipTargetMatchId(String(result.match.id));\n                    void Promise.resolve(\n                      onCommand({ type: "skip-to-result" }),\n                    ).catch(() => setSkipTargetMatchId(null));\n                  }}\n                  type="button"\n                >\n                  結果までスキップ\n                </button>\n              ) : null}\n            </div>',
);

replaceOnce(
  "src/app/GameApp.tsx",
  '            commandPending={cloudSession.operation.status === "submitting"}\n            onCommand={issueMatchCommand}',
  '            commandPending={cloudSession.operation.status === "submitting"}\n            allowResultSkip\n            onCommand={issueMatchCommand}',
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

replaceOnce(
  "tests/unit/features/home/Phase22HomeTraining.test.tsx",
  '    expect(screen.getByText("未設定 1名")).toBeVisible();\n    expect(screen.getByText(`設定済み ${school.playerIds.length - 1}/${school.playerIds.length}名`)).toBeVisible();',
  '    expect(screen.getByText(/未設定 1名/)).toBeVisible();\n    expect(\n      screen.getByText(\n        new RegExp(\n          `設定済み ${school.playerIds.length - 1}/${school.playerIds.length}名`,\n        ),\n      ),\n    ).toBeVisible();',
);

replaceOnce(
  "tests/unit/features/home/homeCommandCenter.test.ts",
  '    expect(training).toMatchObject({\n      priority: "normal",\n      action: { target: "team" },\n      complete: false,\n    });',
  '    expect(training).toMatchObject({\n      priority: "normal",\n      action: undefined,\n      complete: false,\n    });',
);

replaceOnce(
  "tests/unit/features/match/Phase22MatchSkip.test.tsx",
  '        result={fixture.result}\n        reducedMotion={false}',
  '        result={fixture.result}\n        allowResultSkip\n        reducedMotion={false}',
);
replaceOnce(
  "tests/unit/features/match/Phase22MatchSkip.test.tsx",
  '    expect(onCommand).toHaveBeenCalledWith({ type: "skip-to-result" });\n  });\n});',
  '    expect(onCommand).toHaveBeenCalledWith({ type: "skip-to-result" });\n  });\n\n  it("does not expose result skip unless the caller explicitly enables it", () => {\n    const fixture = findIncompleteDecisionMatch();\n\n    render(\n      <MatchScreen\n        state={fixture.state}\n        opponent={fixture.opponent}\n        homeSelection={fixture.homeSelection}\n        awaySelection={fixture.awaySelection}\n        homeStrength={calculateSelectionStrength(\n          fixture.state,\n          fixture.homeSelection,\n        )}\n        awayStrength={calculateSelectionStrength(\n          fixture.state,\n          fixture.awaySelection,\n        )}\n        result={fixture.result}\n        reducedMotion={false}\n        onStart={vi.fn()}\n        onReturnHome={vi.fn()}\n        onCommand={vi.fn()}\n      />,\n    );\n\n    expect(\n      screen.queryByRole("button", { name: "結果までスキップ" }),\n    ).toBeNull();\n  });\n});',
);

console.log("Phase22-2 patch applied");
