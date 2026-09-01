from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Keep the component source-compatible for tests that don't care about the new actions.
p = ROOT / "src/features/home/HomeScreen.tsx"
t = p.read_text(encoding="utf-8")
t = t.replace('  onOpenSchool: () => void;', '  onOpenSchool?: () => void;')
t = t.replace('  onAcceptPracticeOffer: () => void;', '  onAcceptPracticeOffer?: () => void;')
t = t.replace('  onDeclinePracticeOffer: () => void;', '  onDeclinePracticeOffer?: () => void;')
t = t.replace('  operationPending: boolean;', '  operationPending?: boolean;')
t = t.replace('  onOpenSchool,\n', '  onOpenSchool = () => undefined,\n')
t = t.replace('  onAcceptPracticeOffer,\n', '  onAcceptPracticeOffer = () => undefined,\n')
t = t.replace('  onDeclinePracticeOffer,\n', '  onDeclinePracticeOffer = () => undefined,\n')
t = t.replace('  operationPending,\n', '  operationPending = false,\n')
p.write_text(t, encoding="utf-8")

# The old Home regression asserted Phase 11 concepts (fatigue + Training shortcut).
# Update only those assertions/callbacks to the approved Phase 12 behavior.
p = ROOT / "tests/unit/features/home/HomeScreen.test.tsx"
t = p.read_text(encoding="utf-8")
t = t.replace('    onOpenTraining: vi.fn(),\n', '    onOpenSchool: vi.fn(),\n    onAcceptPracticeOffer: vi.fn(),\n    onDeclinePracticeOffer: vi.fn(),\n    operationPending: false,\n')
t = t.replace('expect(within(teamStatus).getByText("疲労")).toBeVisible();', 'expect(within(teamStatus).getByText("調子")).toBeVisible();')
t = t.replace('fireEvent.click(screen.getByRole("button", { name: /育成を決める/ }));', 'fireEvent.click(screen.getByRole("button", { name: /学校を確認/ }));')
t = t.replace('fireEvent.click(screen.getByRole("button", { name: /チーム編成を確認/ }));', 'fireEvent.click(screen.getByRole("button", { name: /選手を確認/ }));')
t = t.replace('expect(props.onOpenTraining).toHaveBeenCalledOnce();', 'expect(props.onOpenSchool).toHaveBeenCalledOnce();')
needle = '    expect(props.onOpenMatch).toHaveBeenCalledOnce();\n'
if needle in t and 'onAcceptPracticeOffer).toHaveBeenCalledOnce' not in t:
    t = t.replace(
        needle,
        needle + '    fireEvent.click(screen.getByRole("button", { name: "受ける" }));\n    fireEvent.click(screen.getByRole("button", { name: "断る" }));\n    expect(props.onAcceptPracticeOffer).toHaveBeenCalledOnce();\n    expect(props.onDeclinePracticeOffer).toHaveBeenCalledOnce();\n',
        1,
    )
p.write_text(t, encoding="utf-8")
