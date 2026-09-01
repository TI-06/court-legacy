from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"missing pattern in {path}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


# ---- Domain: legacy fatigue no longer affects selection/readiness ----
p = "src/domain/team/autoSelectTeam.ts"
t = read(p)
t = t.replace('const SEVERE_FATIGUE_THRESHOLD = 85;\n', '')
t = t.replace(
    '  const readiness = player.condition * 1.2 - player.fatigue * 1.5;',
    '  const readiness = player.condition * 1.2;',
)
t = t.replace(
    '''function isNormallyEligible(player: Player): boolean {\n  return !player.injury && player.fatigue < SEVERE_FATIGUE_THRESHOLD;\n}''',
    '''function isNormallyEligible(player: Player): boolean {\n  return !player.injury;\n}''',
)
t = t.replace('      allowFatigueBenching: true,', '      allowFatigueBenching: false,', 1)
t = t.replace(
    '''  if (\n    player.fatigue >= SEVERE_FATIGUE_THRESHOLD &&\n    selection.substitutionPolicy.allowFatigueBenching\n  ) {\n    return "fatigue";\n  }\n''',
    '',
)
write(p, t)

# Update intentional Phase 12 regressions in the older domain tests.
p = "tests/unit/domain/team/autoSelectTeam.test.ts"
t = read(p)
t = t.replace(
    'it("excludes injured players and severely fatigued players by default"',
    'it("excludes injured players while ignoring legacy fatigue"',
)
t = t.replace(
    '    expect(activeIds.has(exhaustedId)).toBe(false);',
    '    expect(activeIds.has(exhaustedId)).toBe(true);',
    1,
)
start_marker = '  it("benches a severely fatigued locked starter only when enabled", () => {'
end_marker = '  it("benches an injured locked libero when injury exceptions are enabled", () => {'
if start_marker not in t or end_marker not in t:
    raise SystemExit("legacy fatigue starter regression block not found")
start = t.index(start_marker)
end = t.index(end_marker, start)
new_block = '''  it("keeps a fatigued locked starter regardless of the legacy fatigue policy", () => {\n    const { state, school } = prepareRoleRoster();\n    const base = autoSelectTeam({ state, schoolId: school.id });\n    const lockedId = base.rotation[0]!.playerId;\n    state.players[lockedId] = {\n      ...state.players[lockedId]!,\n      fatigue: 100,\n    };\n\n    for (const allowFatigueBenching of [true, false]) {\n      const result = resolveLockedStarters({\n        state,\n        schoolId: school.id,\n        selection: {\n          ...base,\n          substitutionPolicy: {\n            ...base.substitutionPolicy,\n            starterLockPlayerIds: [lockedId],\n            allowFatigueBenching,\n          },\n        },\n      });\n\n      expect(\n        result.selection.rotation.some((item) => item.playerId === lockedId),\n      ).toBe(true);\n      expect(result.replacements).toEqual([]);\n    }\n  });\n\n'''
t = t[:start] + new_block + t[end:]
write(p, t)

# ---- Team UI: role first, rotation secondary, explicit replacement context ----
p = "src/features/team/TeamScreen.tsx"
t = read(p)
t = t.replace(
    'import type { Player } from "../../domain/model/Player";',
    'import type { Player, Position } from "../../domain/model/Player";',
)
needle = '''type PickerTarget =\n  { type: "rotation"; slot: RotationSlot } | { type: "libero" };'''
if needle not in t:
    raise SystemExit("PickerTarget marker not found")
t = t.replace(
    needle,
    needle
    + '''\n\nconst ROTATION_ROLES: Record<RotationSlot, Position> = {\n  1: "S",\n  2: "MB",\n  3: "MB",\n  4: "OH",\n  5: "OH",\n  6: "OP",\n};''',
    1,
)
t = t.replace(
    '  const reason = replacement.reason === "injury" ? "怪我" : "重度疲労";',
    '  const reason = replacement.reason === "injury" ? "怪我" : "状態";',
)
old_picker = '''  const currentPickerPlayer = currentPickerPlayerId\n    ? playerById[currentPickerPlayerId]\n    : null;\n\n  const choosePickerPlayer = (playerId: PlayerId) => {'''
new_picker = '''  const currentPickerPlayer = currentPickerPlayerId\n    ? playerById[currentPickerPlayerId]\n    : null;\n  const currentPickerRole: Position | null =\n    pickerTarget?.type === "rotation"\n      ? ROTATION_ROLES[pickerTarget.slot]\n      : pickerTarget?.type === "libero"\n        ? "L"\n        : null;\n\n  const choosePickerPlayer = (playerId: PlayerId) => {'''
if old_picker not in t:
    raise SystemExit("current picker marker not found")
t = t.replace(old_picker, new_picker, 1)
t = t.replace(
    '''  const pickerTitle =\n    pickerTarget?.type === "rotation"\n      ? `ローテーション${pickerTarget.slot}の選手を選択`\n      : pickerTarget?.type === "libero"\n        ? "リベロの選手を選択"\n        : "選手を選択";''',
    '''  const pickerTitle =\n    pickerTarget?.type === "rotation"\n      ? `ローテーション${pickerTarget.slot}を入れ替え`\n      : pickerTarget?.type === "libero"\n        ? "リベロを入れ替え"\n        : "選手を入れ替え";''',
)
old_card = '''                      <span className="court-player-button__top">\n                        <b>{assignment.slot}</b>\n                        {locked ? <small>固定</small> : null}\n                      </span>\n                      <strong>{player.lastName}</strong>\n                      <span>\n                        {player.preferredPosition}・総合{playerOverall(player)}\n                      </span>'''
new_card = '''                      <span className="court-player-button__top">\n                        <b>{ROTATION_ROLES[assignment.slot]}</b>\n                        <small>R{assignment.slot}</small>\n                        {locked ? <small>固定</small> : null}\n                      </span>\n                      <strong>{player.lastName}</strong>\n                      <span>\n                        本職 {player.preferredPosition}・適性\n                        {player.positionAptitudes[ROTATION_ROLES[assignment.slot]]}\n                        ・総合{playerOverall(player)}\n                      </span>'''
if old_card not in t:
    raise SystemExit("court card marker not found")
t = t.replace(old_card, new_card, 1)
fatigue_policy = '''            <label>\n              <span>\n                <strong>重度疲労時はベンチを許可</strong>\n                <small>疲労85以上を安全交代の対象にします。</small>\n              </span>\n              <input\n                aria-label="重度疲労時はベンチを許可"\n                checked={selection.substitutionPolicy.allowFatigueBenching}\n                disabled={pending}\n                onChange={(event) =>\n                  updatePolicy("allowFatigueBenching", event.target.checked)\n                }\n                type="checkbox"\n              />\n            </label>\n'''
if fatigue_policy not in t:
    raise SystemExit("fatigue policy UI block not found")
t = t.replace(fatigue_policy, '', 1)
context_marker = '''        >\n          {currentPickerPlayer ? (\n            <button\n              aria-label={`先発固定 ${playerName(currentPickerPlayer)}`}'''
context_replacement = '''        >\n          {currentPickerPlayer && pickerTarget ? (\n            <div className="slot-editor-context">\n              <div>\n                <span>変更する枠</span>\n                <strong>\n                  {pickerTarget.type === "rotation"\n                    ? `ローテーション${pickerTarget.slot}`\n                    : "リベロ"}\n                </strong>\n                {currentPickerRole ? <b>{currentPickerRole}</b> : null}\n              </div>\n              <p>\n                現在：{playerName(currentPickerPlayer)}・\n                {currentPickerPlayer.preferredPosition}・総合\n                {playerOverall(currentPickerPlayer)}\n              </p>\n            </div>\n          ) : null}\n          {currentPickerPlayer ? (\n            <button\n              aria-label={`先発固定 ${playerName(currentPickerPlayer)}`}'''
if context_marker not in t:
    raise SystemExit("bottom sheet context insertion marker not found")
t = t.replace(context_marker, context_replacement, 1)
old_action = '''                  actionLabel={\n                    isCurrent\n                      ? "選択中"\n                      : isActiveElsewhere\n                        ? "コート使用中"\n                        : "入れ替える"\n                  }'''
new_action = '''                  actionLabel={\n                    isCurrent\n                      ? "現在"\n                      : isActiveElsewhere\n                        ? "使用中"\n                        : currentPickerRole\n                          ? `${currentPickerRole}適性${player.positionAptitudes[currentPickerRole]}・入替`\n                          : "入替"\n                  }'''
if old_action not in t:
    raise SystemExit("picker action label marker not found")
t = t.replace(old_action, new_action, 1)
write(p, t)

# Existing flow tests intentionally follow the new picker title.
p = "tests/unit/features/team/TeamSelectionFlow.test.tsx"
t = read(p).replace("ローテーション1の選手を選択", "ローテーション1を入れ替え")
write(p, t)

# Team CSS for role badge + persistent target context.
p = "src/features/team/team-direct.css"
t = read(p)
t = t.replace(
    '''.court-player-button__top b {\n  display: grid;\n  width: 18px;\n  height: 18px;''',
    '''.court-player-button__top b {\n  display: grid;\n  min-width: 28px;\n  height: 20px;\n  padding: 0 5px;''',
)
t += '''\n\n.slot-editor-context {\n  display: grid;\n  margin-bottom: 9px;\n  padding: 10px 11px;\n  gap: 5px;\n  background: #eaf3f5;\n  border: 1px solid #cfe0e4;\n  border-radius: 12px;\n}\n\n.slot-editor-context > div {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n}\n\n.slot-editor-context span {\n  color: #6a7c84;\n  font-size: 12px;\n  font-weight: 800;\n}\n\n.slot-editor-context strong {\n  color: #173f4a;\n  font-size: 14px;\n}\n\n.slot-editor-context b {\n  padding: 3px 7px;\n  color: #fff;\n  font-size: 12px;\n  background: #286f7c;\n  border-radius: 7px;\n}\n\n.slot-editor-context p {\n  margin: 0;\n  color: #4e6570;\n  font-size: 12px;\n  line-height: 1.4;\n}\n'''
write(p, t)

# ---- School UI: compact facility tiles, details in sheet ----
p = "src/features/school/SchoolScreen.tsx"
t = read(p)
start_marker = '          <div className="facility-list">'
end_marker = '          </div>\n        </section>\n      ) : null}\n\n      {view === "records" ? ('
if start_marker not in t or end_marker not in t:
    raise SystemExit("facility list block markers not found")
start = t.index(start_marker)
end = t.index(end_marker, start)
new_facilities = '''          <div className="facility-grid">\n            {FACILITY_DEFINITIONS.map((definition) => {\n              const evaluation = evaluateFacilityUpgrade(\n                state,\n                school.id,\n                definition.key,\n              );\n              const missingFunds = Math.max(0, evaluation.cost - school.funds);\n              const status =\n                evaluation.reason === "max-level"\n                  ? "最大Lv"\n                  : evaluation.reason === "insufficient-funds"\n                    ? `あと${missingFunds}必要`\n                    : evaluation.reason === "invalid-level"\n                      ? "要確認"\n                      : `次 ${evaluation.cost}`;\n              return (\n                <button\n                  aria-label={`${definition.name}の詳細`}\n                  className="facility-tile"\n                  data-testid="facility-tile"\n                  key={definition.key}\n                  onClick={() => setSelectedFacility(definition.key)}\n                  type="button"\n                >\n                  <span className="facility-tile__top">\n                    <strong>{definition.name}</strong>\n                    <b>Lv.{evaluation.currentLevel}</b>\n                  </span>\n                  <small\n                    className={\n                      evaluation.allowed ? undefined : "facility-tile__warning"\n                    }\n                  >\n                    {status}\n                  </small>\n                  <span className="facility-tile__detail" aria-hidden="true">\n                    詳細 ›\n                  </span>\n                </button>\n              );\n            })}\n          </div>\n'''
t = t[:start] + new_facilities + t[end + len('          </div>\n'):]
old_confirmation = '''          <div className="facility-confirmation">\n            <strong>{selectedDefinition.name}</strong>\n            <p>\n              Lv.{selectedEvaluation.currentLevel} → Lv.\n              {selectedEvaluation.nextLevel}\n            </p>'''
new_confirmation = '''          <div className="facility-confirmation">\n            <strong>{selectedDefinition.name}</strong>\n            <p className="facility-confirmation__description">\n              {selectedDefinition.description}\n            </p>\n            <p className="facility-confirmation__level">\n              Lv.{selectedEvaluation.currentLevel} → Lv.\n              {selectedEvaluation.nextLevel}\n            </p>'''
if old_confirmation not in t:
    raise SystemExit("facility confirmation marker not found")
t = t.replace(old_confirmation, new_confirmation, 1)
old_button = '''            <button\n              className="primary-action"\n              disabled={!selectedEvaluation.allowed}\n              onClick={confirmUpgrade}\n              type="button"\n            >'''
new_button = '''            <button\n              aria-label={\n                selectedEvaluation.allowed\n                  ? undefined\n                  : facilityActionLabel(\n                      selectedDefinition.name,\n                      selectedEvaluation.reason,\n                    )\n              }\n              className="primary-action"\n              disabled={!selectedEvaluation.allowed}\n              onClick={confirmUpgrade}\n              type="button"\n            >'''
if old_button not in t:
    raise SystemExit("facility confirmation button marker not found")
t = t.replace(old_button, new_button, 1)
write(p, t)

# School CSS: four compact tabs + dense two-column facilities.
p = "src/features/school/school-screen.css"
t = read(p)
t = t.replace('  grid-template-columns: repeat(3, minmax(0, 1fr));\n  width: 100%;', '  grid-template-columns: repeat(4, minmax(0, 1fr));\n  width: 100%;', 1)
t += '''\n\n.facility-grid {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  margin-top: 10px;\n  gap: 7px;\n}\n\n.facility-tile {\n  display: grid;\n  min-width: 0;\n  min-height: 72px;\n  padding: 9px 10px;\n  gap: 4px;\n  color: #193e48;\n  font: inherit;\n  text-align: left;\n  background: #f4f8f9;\n  border: 1px solid #dce6e9;\n  border-radius: 12px;\n}\n\n.facility-tile__top {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  min-width: 0;\n  gap: 5px;\n}\n\n.facility-tile__top strong {\n  overflow: hidden;\n  font-size: 0.76rem;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.facility-tile__top b {\n  flex: 0 0 auto;\n  padding: 2px 5px;\n  color: #23616e;\n  font-size: 0.61rem;\n  background: #dcecef;\n  border-radius: 999px;\n}\n\n.facility-tile small {\n  color: #58717b;\n  font-size: 0.63rem;\n  font-weight: 800;\n}\n\n.facility-tile .facility-tile__warning {\n  color: #98600c;\n}\n\n.facility-tile__detail {\n  justify-self: end;\n  color: #37717d;\n  font-size: 0.63rem;\n  font-weight: 900;\n}\n\n.facility-confirmation__description {\n  margin: 0;\n  color: #667a83;\n  font-size: 0.75rem;\n  font-weight: 500;\n  line-height: 1.55;\n}\n\n.facility-confirmation__level {\n  margin: 0;\n  color: #1c5965;\n  font-size: 1.2rem;\n  font-weight: 900;\n}\n\n@media (max-width: 350px) {\n  .school-segments button {\n    padding-inline: 4px;\n    font-size: 0.68rem;\n  }\n\n  .facility-tile {\n    padding-inline: 8px;\n  }\n}\n'''
# Avoid the old generic rule making the description huge.
t = t.replace(
    '''.facility-confirmation > p {\n  margin: 0;\n  color: #1c5965;\n  font-size: 1.2rem;\n  font-weight: 900;\n}\n''',
    '',
)
write(p, t)

# Existing school tests intentionally follow the detail-first flow.
p = "tests/unit/features/school/SchoolScreen.test.tsx"
t = read(p)
t = t.replace('name: "トレーニング設備を強化"', 'name: "トレーニング設備の詳細"', 1)
old_disabled = '''    expect(\n      screen.getByRole("button", { name: "体育館は最大レベル" }),\n    ).toBeDisabled();\n    expect(\n      screen.getByRole("button", { name: "トレーニング設備は資金不足" }),\n    ).toBeDisabled();\n    expect(screen.getByText("あと60必要")).toBeVisible();'''
new_disabled = '''    expect(screen.getByText("あと60必要")).toBeVisible();\n\n    fireEvent.click(screen.getByRole("button", { name: "体育館の詳細" }));\n    let dialog = screen.getByRole("dialog", { name: "設備を強化" });\n    expect(\n      within(dialog).getByRole("button", { name: "体育館は最大レベル" }),\n    ).toBeDisabled();\n    fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));\n\n    fireEvent.click(\n      screen.getByRole("button", { name: "トレーニング設備の詳細" }),\n    );\n    dialog = screen.getByRole("dialog", { name: "設備を強化" });\n    expect(\n      within(dialog).getByRole("button", {\n        name: "トレーニング設備は資金不足",\n      }),\n    ).toBeDisabled();'''
if old_disabled not in t:
    raise SystemExit("school disabled-upgrade regression block not found")
t = t.replace(old_disabled, new_disabled, 1)
write(p, t)
