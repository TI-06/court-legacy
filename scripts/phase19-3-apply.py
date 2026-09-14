from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected marker once, found {count}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# Worker: pass the optional bulk level count through to the domain atomically.
replace_once(
    "worker/game/applyGameAction.ts",
    '''  const evaluation = evaluateFacilityUpgrade(\n    state,\n    state.userSchoolId,\n    action.facility,\n  );''',
    '''  const levels = action.levels ?? 1;\n  const evaluation = evaluateFacilityUpgrade(\n    state,\n    state.userSchoolId,\n    action.facility,\n    levels,\n  );''',
)
replace_once(
    "worker/game/applyGameAction.ts",
    '''    state: upgradeFacility(state, state.userSchoolId, action.facility),''',
    '''    state: upgradeFacility(\n      state,\n      state.userSchoolId,\n      action.facility,\n      levels,\n    ),''',
)
replace_once(
    "worker/game/applyGameAction.ts",
    '''      case "specialty-not-allowed":\n        message = "初級コーチに専門分野は設定できません";\n        break;\n      case "available":''',
    '''      case "specialty-not-allowed":\n        message = "初級コーチに専門分野は設定できません";\n        break;\n      case "already-contracted-this-year":\n        message = "今年度のコーチ契約は完了しています";\n        break;\n      case "available":''',
)

# GameApp: expose bulk facility levels and wire the annual coach action to the live Worker path.
replace_once(
    "src/app/GameApp.tsx",
    '''import type { SchoolReputation } from "../domain/model/School";''',
    '''import type { SchoolReputation } from "../domain/model/School";\nimport type {\n  AssistantCoachRank,\n  AssistantCoachSpecialty,\n} from "../domain/model/SchoolManagement";''',
)
replace_once(
    "src/app/GameApp.tsx",
    '''import type { FacilityKey } from "../domain/school/facilityUpgrade";''',
    '''import type {\n  FacilityKey,\n  FacilityUpgradeLevels,\n} from "../domain/school/facilityUpgrade";''',
)
replace_once(
    "src/app/GameApp.tsx",
    '''  const upgradeSchoolFacility = async (key: FacilityKey) => {\n    await cloudSession.runAction(\n      { type: "facility-upgrade", facility: key },\n      "施設を更新しています…",\n    );\n  };''',
    '''  const upgradeSchoolFacility = async (\n    key: FacilityKey,\n    levels: FacilityUpgradeLevels,\n  ) => {\n    await cloudSession.runAction(\n      { type: "facility-upgrade", facility: key, levels },\n      `施設を${levels}レベル強化しています…`,\n    );\n  };\n\n  const contractAssistantCoachFromUi = async (\n    rank: AssistantCoachRank,\n    specialty: AssistantCoachSpecialty | null,\n  ) => {\n    await cloudSession.runAction(\n      { type: "assistant-coach-contract", rank, specialty },\n      "年間コーチ契約を保存しています…",\n    );\n  };''',
)
replace_once(
    "src/app/GameApp.tsx",
    '''      <SchoolScreen\n        onOpenScouting={openScouting}\n        onUpgradeFacility={upgradeSchoolFacility}\n        state={gameState}\n      />''',
    '''      <SchoolScreen\n        onContractAssistantCoach={contractAssistantCoachFromUi}\n        onOpenScouting={openScouting}\n        onUpgradeFacility={upgradeSchoolFacility}\n        state={gameState}\n      />''',
)

# School screen: let the player select +1/+5/+10, show exact cost, and keep contract state clear.
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''  FACILITY_DEFINITIONS,\n  evaluateFacilityUpgrade,\n  type FacilityKey,\n} from "../../domain/school/facilityUpgrade";''',
    '''  FACILITY_DEFINITIONS,\n  FACILITY_UPGRADE_LEVEL_OPTIONS,\n  evaluateFacilityUpgrade,\n  type FacilityKey,\n  type FacilityUpgradeLevels,\n} from "../../domain/school/facilityUpgrade";''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''  onUpgradeFacility: (key: FacilityKey) => void | Promise<unknown>;''',
    '''  onUpgradeFacility: (\n    key: FacilityKey,\n    levels: FacilityUpgradeLevels,\n  ) => void | Promise<unknown>;''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''  const [facilityUpgradePending, setFacilityUpgradePending] = useState(false);''',
    '''  const [selectedUpgradeLevels, setSelectedUpgradeLevels] =\n    useState<FacilityUpgradeLevels>(1);\n  const [facilityUpgradePending, setFacilityUpgradePending] = useState(false);''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''  const selectedEvaluation = selectedFacility\n    ? evaluateFacilityUpgrade(state, school.id, selectedFacility)\n    : null;''',
    '''  const selectedEvaluation = selectedFacility\n    ? evaluateFacilityUpgrade(\n        state,\n        school.id,\n        selectedFacility,\n        selectedUpgradeLevels,\n      )\n    : null;''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''      await onUpgradeFacility(selectedFacility);''',
    '''      await onUpgradeFacility(selectedFacility, selectedUpgradeLevels);''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''                  onClick={() => setSelectedFacility(definition.key)}''',
    '''                  onClick={() => {\n                    setSelectedFacility(definition.key);\n                    setSelectedUpgradeLevels(1);\n                  }}''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''                      {evaluation.reason === "insufficient-funds"\n                        ? `あと${missingFunds}必要`\n                        : evaluation.reason === "specialty-required"\n                          ? "専門を選択してください"\n                          : `契約後 ${evaluation.fundsAfter}`}''',
    '''                      {evaluation.reason === "insufficient-funds"\n                        ? `あと${missingFunds}必要`\n                        : evaluation.reason === "specialty-required"\n                          ? "専門を選択してください"\n                          : evaluation.reason === "already-contracted-this-year"\n                            ? "今年度は契約済み"\n                            : evaluation.reason === "specialty-not-allowed"\n                              ? "専門指定なしで契約してください"\n                              : `契約後 ${evaluation.fundsAfter}`}''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''        description="資金を使用して設備レベルを1上げます。連続して強化できます。"''',
    '''        description="資金があれば1・5・10レベル単位でまとめて強化できます。費用は各レベル分の合計です。"''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''            <p className="facility-confirmation__level">\n              Lv.{selectedEvaluation.currentLevel} → Lv.\n              {selectedEvaluation.nextLevel}\n            </p>''',
    '''            <div\n              aria-label="強化レベルを選択"\n              className="facility-upgrade-options"\n              role="group"\n            >\n              {FACILITY_UPGRADE_LEVEL_OPTIONS.map((levels) => {\n                const optionEvaluation = evaluateFacilityUpgrade(\n                  state,\n                  school.id,\n                  selectedFacility,\n                  levels,\n                );\n                return (\n                  <button\n                    aria-pressed={selectedUpgradeLevels === levels}\n                    className={\n                      selectedUpgradeLevels === levels\n                        ? "facility-upgrade-option facility-upgrade-option--selected"\n                        : "facility-upgrade-option"\n                    }\n                    disabled={!optionEvaluation.allowed || facilityUpgradePending}\n                    key={levels}\n                    onClick={() => setSelectedUpgradeLevels(levels)}\n                    type="button"\n                  >\n                    <strong>+{levels} Lv</strong>\n                    <small>\n                      {optionEvaluation.reason === "max-level"\n                        ? "上限超過"\n                        : optionEvaluation.reason === "insufficient-funds"\n                          ? `${optionEvaluation.cost}・資金不足`\n                          : `${optionEvaluation.cost}`}\n                    </small>\n                  </button>\n                );\n              })}\n            </div>\n            <p className="facility-confirmation__level">\n              Lv.{selectedEvaluation.currentLevel} → Lv.\n              {selectedEvaluation.nextLevel}\n            </p>''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''              {facilityUpgradePending\n                ? "強化中…"\n                : `${selectedEvaluation.cost}を使って強化`}''',
    '''              {facilityUpgradePending\n                ? "強化中…"\n                : `+${selectedUpgradeLevels} Lv・${selectedEvaluation.cost}を使って強化`}''',
)

# CSS for compact mobile-first bulk choices.
css_path = Path("src/features/school/school-screen.css")
css = css_path.read_text(encoding="utf-8")
marker = "/* phase19-3 bulk facility upgrades */"
if marker not in css:
    css += '''\n\n/* phase19-3 bulk facility upgrades */\n.facility-upgrade-options {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 8px;\n}\n\n.facility-upgrade-option {\n  min-width: 0;\n  min-height: 52px;\n  display: grid;\n  gap: 2px;\n  place-items: center;\n  padding: 8px 6px;\n}\n\n.facility-upgrade-option strong,\n.facility-upgrade-option small {\n  white-space: nowrap;\n}\n\n.facility-upgrade-option--selected {\n  outline: 2px solid currentColor;\n  outline-offset: 1px;\n}\n\n@media (max-width: 360px) {\n  .facility-upgrade-options {\n    gap: 6px;\n  }\n\n  .facility-upgrade-option {\n    font-size: 0.82rem;\n    padding-inline: 4px;\n  }\n}\n'''
    css_path.write_text(css, encoding="utf-8")

# Update existing UI test for explicit +1 and add a bulk selection assertion.
replace_once(
    "tests/unit/features/school/SchoolScreen.test.tsx",
    '''    fireEvent.click(\n      within(dialog).getByRole("button", { name: "70を使って強化" }),\n    );\n    expect(onUpgradeFacility).toHaveBeenCalledWith("trainingRoom");''',
    '''    fireEvent.click(\n      within(dialog).getByRole("button", { name: "+1 Lv・70を使って強化" }),\n    );\n    expect(onUpgradeFacility).toHaveBeenCalledWith("trainingRoom", 1);''',
)
replace_once(
    "tests/unit/features/school/SchoolScreen.test.tsx",
    '''  it("opens the funds ledger and renders persisted history newest first", () => {''',
    '''  it("lets the player choose +5 or +10 bulk facility upgrades", () => {\n    const state = createState();\n    const school = state.schools[state.userSchoolId]!;\n    state.schools[state.userSchoolId] = { ...school, funds: 5000 };\n    const onUpgradeFacility = vi.fn();\n\n    render(\n      <SchoolScreen onUpgradeFacility={onUpgradeFacility} state={state} />,\n    );\n    fireEvent.click(\n      screen.getByRole("button", { name: "トレーニング設備の詳細" }),\n    );\n    const dialog = screen.getByRole("dialog", { name: "設備を強化" });\n\n    fireEvent.click(within(dialog).getByRole("button", { name: /\\+5 Lv/ }));\n    expect(within(dialog).getByText("Lv.0 → Lv.5")).toBeVisible();\n    fireEvent.click(\n      within(dialog).getByRole("button", { name: "+5 Lv・381を使って強化" }),\n    );\n    expect(onUpgradeFacility).toHaveBeenCalledWith("trainingRoom", 5);\n  });\n\n  it("opens the funds ledger and renders persisted history newest first", () => {''',
)

# Add a focused Worker/action contract test.
Path("tests/unit/worker/phase19EconomyFacilityCoachAction.test.ts").write_text(
    '''import { describe, expect, it } from "vitest";\nimport { createDemoSnapshot } from "../../../src/app/createDemoGame";\nimport { applyGameAction } from "../../../worker/game/applyGameAction";\nimport { gameActionRequestSchema } from "../../../worker/game/actionSchema";\n\ndescribe("Phase19 PR19-3 Worker action contract", () => {\n  it("accepts explicit +5/+10 levels while keeping missing levels backward compatible", () => {\n    const base = { operationId: "phase19-3", revision: 1 };\n    expect(\n      gameActionRequestSchema.parse({\n        ...base,\n        action: { type: "facility-upgrade", facility: "trainingRoom", levels: 10 },\n      }).action,\n    ).toMatchObject({ type: "facility-upgrade", levels: 10 });\n    expect(\n      gameActionRequestSchema.parse({\n        ...base,\n        action: { type: "facility-upgrade", facility: "trainingRoom" },\n      }).action,\n    ).toEqual({ type: "facility-upgrade", facility: "trainingRoom" });\n  });\n\n  it("applies an atomic +5 facility upgrade through the authoritative action", () => {\n    const snapshot = createDemoSnapshot();\n    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;\n    snapshot.state.schools[snapshot.state.userSchoolId] = {\n      ...school,\n      funds: 1000,\n    };\n\n    const applied = applyGameAction(snapshot, {\n      type: "facility-upgrade",\n      facility: "trainingRoom",\n      levels: 5,\n    });\n    expect(\n      applied.state.schools[applied.state.userSchoolId]!.facilities.trainingRoom,\n    ).toBe(5);\n    expect(applied.state.schools[applied.state.userSchoolId]!.funds).toBe(619);\n  });\n\n  it("rejects a second assistant coach contract in the same academic year", () => {\n    const snapshot = createDemoSnapshot();\n    const first = applyGameAction(snapshot, {\n      type: "assistant-coach-contract",\n      rank: "beginner",\n      specialty: null,\n    });\n\n    expect(() =>\n      applyGameAction(\n        { ...snapshot, state: first.state },\n        {\n          type: "assistant-coach-contract",\n          rank: "intermediate",\n          specialty: "attack",\n        },\n      ),\n    ).toThrow(/今年度のコーチ契約は完了しています/);\n  });\n});\n''',
    encoding="utf-8",
)
