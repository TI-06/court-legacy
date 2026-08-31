from pathlib import Path
import subprocess


def run(*args: str, check: bool = True):
    return subprocess.run(args, check=check)


def add_red_assertions() -> None:
    p = Path("tests/unit/features/home/TrainingResultNotificationSheet.test.tsx")
    text = p.read_text()
    anchor = '    expect(within(dialog).getByText("怪我あり")).toBeVisible();\n'
    if anchor not in text:
        raise RuntimeError("training result test anchor missing")
    addition = '''    expect(
      within(dialog).getByText("能力成長").closest("div"),
    ).toHaveAttribute("data-tone", "positive");
    expect(within(dialog).getByText("疲労").closest("div")).toHaveAttribute(
      "data-tone",
      "warning",
    );
    expect(within(dialog).getByText("怪我").closest("div")).toHaveAttribute(
      "data-tone",
      "danger",
    );
'''
    p.write_text(text.replace(anchor, anchor + addition))


def implement_semantic_tones() -> None:
    p = Path("src/features/home/TrainingResultNotificationSheet.tsx")
    text = p.read_text()
    anchor = '''function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
'''
    if anchor not in text:
        raise RuntimeError("signed helper anchor missing")
    helpers = '''function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function growthTone(value: number): "positive" | "neutral" | "danger" {
  if (value > 0) return "positive";
  if (value < 0) return "danger";
  return "neutral";
}

function fatigueTone(value: number): "positive" | "neutral" | "warning" {
  if (value > 0) return "warning";
  if (value < 0) return "positive";
  return "neutral";
}
'''
    text = text.replace(anchor, helpers)
    text = text.replace(
        '''            <div>
              <span>能力成長</span>''',
        '''            <div data-tone={growthTone(notification.payload.totalAbilityGrowth)}>
              <span>能力成長</span>''',
    )
    text = text.replace(
        '''            <div>
              <span>疲労</span>''',
        '''            <div data-tone={fatigueTone(notification.payload.totalFatigueChange)}>
              <span>疲労</span>''',
    )
    text = text.replace(
        '''            <div>
              <span>怪我</span>''',
        '''            <div data-tone={notification.payload.injuredCount > 0 ? "danger" : "neutral"}>
              <span>怪我</span>''',
    )
    old = '''                            <span key={ability}>
                              {abilityLabels[ability]} {signed(value)}
                            </span>'''
    new = '''                            <span data-tone={growthTone(value)} key={ability}>
                              {abilityLabels[ability]} {signed(value)}
                            </span>'''
    if old not in text:
        raise RuntimeError("ability chip anchor missing")
    text = text.replace(old, new)
    old = '''                      <div className="training-result-notification__changes">
                        <span>疲労 {signed(player.fatigueChange)}</span>
                        <span>
                          コンディション {signed(player.conditionChange)}
                        </span>
                        <span>信頼 {signed(player.trustChange)}</span>
                        <span className={player.injured ? "is-injured" : ""}>
                          {player.injured ? "怪我あり" : "怪我なし"}
                        </span>
                      </div>'''
    new = '''                      <div className="training-result-notification__changes">
                        <span data-tone={fatigueTone(player.fatigueChange)}>
                          疲労 {signed(player.fatigueChange)}
                        </span>
                        <span data-tone={growthTone(player.conditionChange)}>
                          コンディション {signed(player.conditionChange)}
                        </span>
                        <span data-tone={growthTone(player.trustChange)}>
                          信頼 {signed(player.trustChange)}
                        </span>
                        <span data-tone={player.injured ? "danger" : "neutral"}>
                          {player.injured ? "怪我あり" : "怪我なし"}
                        </span>
                      </div>'''
    if old not in text:
        raise RuntimeError("player change chips anchor missing")
    p.write_text(text.replace(old, new))


def apply_high_contrast_css() -> None:
    p = Path("src/features/home/training-result-notification.css")
    text = p.read_text()
    start = text.index('.training-result-notification {')
    prefix = text[:start]
    replacement = r'''.training-result-notification {
  display: grid;
  gap: var(--game-space-md);
  color: #18303b;
}

.training-result-notification__menu {
  display: grid;
  padding: 12px;
  gap: 4px;
  background: #ffffff;
  border: 1px solid #cbd8dd;
  border-radius: var(--game-radius-sm);
}

.training-result-notification__menu span,
.training-result-notification__summary span {
  color: #4d626d;
  font-size: var(--game-font-label);
  font-weight: 800;
}

.training-result-notification__menu strong {
  color: #132c37;
  font-size: var(--game-font-card-title);
  font-weight: 900;
  line-height: 1.3;
}

.training-result-notification__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #cbd8dd;
  border-radius: var(--game-radius-sm);
  box-shadow: 0 5px 16px rgb(25 55 68 / 8%);
}

.training-result-notification__summary > div {
  min-width: 0;
  padding: 11px 6px;
  text-align: center;
}

.training-result-notification__summary > div + div {
  border-left: 1px solid #d7e1e5;
}

.training-result-notification__summary strong {
  display: block;
  margin-top: 4px;
  color: #18303b;
  font-size: 20px;
  font-weight: 950;
  line-height: 1;
}

.training-result-notification__summary [data-tone="positive"] strong {
  color: #12613f;
}

.training-result-notification__summary [data-tone="warning"] strong {
  color: #8a4b00;
}

.training-result-notification__summary [data-tone="danger"] strong {
  color: #a12920;
}

.training-result-notification__players {
  display: grid;
  gap: 8px;
}

.training-result-notification__players h3 {
  margin: 0;
  color: #18303b;
  font-size: var(--game-font-body);
  font-weight: 900;
  line-height: 1.3;
}

.training-result-notification__player-list {
  display: grid;
  gap: 8px;
}

.training-result-notification__player {
  display: grid;
  gap: 8px;
  padding: 11px;
  color: #203843;
  background: #ffffff;
  border: 1px solid #cfdce1;
  border-radius: var(--game-radius-sm);
  box-shadow: 0 3px 12px rgb(25 55 68 / 6%);
}

.training-result-notification__player header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  min-width: 0;
  gap: 8px;
}

.training-result-notification__player header strong {
  overflow: hidden;
  min-width: 0;
  color: #132c37;
  font-size: var(--game-font-body);
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.training-result-notification__player header span {
  flex: 0 0 auto;
  color: #536873;
  font-size: var(--game-font-label);
  font-weight: 800;
}

.training-result-notification__abilities,
.training-result-notification__changes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.training-result-notification__abilities span,
.training-result-notification__changes span {
  padding: 5px 7px;
  color: #304b57;
  font-size: var(--game-font-label);
  font-weight: 850;
  line-height: 1.25;
  background: #edf3f5;
  border: 1px solid #d7e1e5;
  border-radius: 8px;
}

.training-result-notification [data-tone="positive"] {
  color: #0e6140;
  background: #e3f5ec;
  border-color: #addcc7;
}

.training-result-notification [data-tone="warning"] {
  color: #835000;
  background: #fff1cf;
  border-color: #ebce88;
}

.training-result-notification [data-tone="danger"] {
  color: #982a22;
  background: #ffe7e2;
  border-color: #e8b8b0;
}

.training-result-notification__no-growth {
  margin: 0;
  color: #536873;
  font-size: var(--game-font-label);
  font-weight: 700;
  line-height: 1.35;
}

@media (max-width: 359px) {
  .training-result-notification__summary strong {
    font-size: 18px;
  }

  .training-result-notification__player header {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }
}
'''
    p.write_text(prefix + replacement)


add_red_assertions()
run("npx", "prettier", "--write", "tests/unit/features/home/TrainingResultNotificationSheet.test.tsx")
red = run("npm", "test", "--", "tests/unit/features/home/TrainingResultNotificationSheet.test.tsx", check=False)
if red.returncode == 0:
    raise SystemExit("Task4 RED unexpectedly passed")
print("Task4 RED confirmed")
implement_semantic_tones()
apply_high_contrast_css()
run(
    "npx",
    "prettier",
    "--write",
    "src/features/home/TrainingResultNotificationSheet.tsx",
    "tests/unit/features/home/TrainingResultNotificationSheet.test.tsx",
)
run("npm", "test", "--", "tests/unit/features/home/TrainingResultNotificationSheet.test.tsx", "tests/unit/features/home/HomeScreen.test.tsx")
run("npm", "run", "typecheck")
