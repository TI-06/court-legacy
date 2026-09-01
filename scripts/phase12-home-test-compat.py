from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/features/home/HomeScreen.tsx"
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
