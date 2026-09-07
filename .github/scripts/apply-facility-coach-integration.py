from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    target.write_text(text.replace(old, new, 1))


def replace_count(path: str, old: str, new: str, expected: int) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count}")
    target.write_text(text.replace(old, new))


replace_once(
    "worker/game/applyGameAction.ts",
    'import { SeededRandom } from "../../src/domain/random/SeededRandom";\nimport {\n  evaluateFacilityUpgrade,',
    'import { SeededRandom } from "../../src/domain/random/SeededRandom";\nimport {\n  contractAssistantCoach,\n  evaluateAssistantCoachContract,\n} from "../../src/domain/school/assistantCoach";\nimport {\n  evaluateFacilityUpgrade,',
)
replace_once(
    "worker/game/applyGameAction.ts",
    '''function applyEventChoice(
  state: GameState,''',
    '''function applyAssistantCoachContract(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "assistant-coach-contract" }>,
): AppliedGameAction {
  const evaluation = evaluateAssistantCoachContract(
    state,
    action.rank,
    action.specialty,
  );
  if (!evaluation.allowed) {
    let message = "コーチと契約できません";
    switch (evaluation.reason) {
      case "insufficient-funds":
        message = "コーチ契約に必要な資金が不足しています";
        break;
      case "specialty-required":
        message = "中級以上のコーチは専門分野を選んでください";
        break;
      case "specialty-not-allowed":
        message = "初級コーチに専門分野は設定できません";
        break;
      case "available":
        break;
    }
    return conflict(
      `assistant_coach_${evaluation.reason.replaceAll("-", "_")}`,
      message,
    );
  }

  return {
    state: contractAssistantCoach(state, action.rank, action.specialty),
    teamSelection,
    outcome: evaluation,
  };
}

function applyEventChoice(
  state: GameState,''',
)
replace_once(
    "worker/game/applyGameAction.ts",
    '''    case "facility-upgrade":
      return applyFacilityUpgrade(state, teamSelection, action);
    case "event-choice":''',
    '''    case "facility-upgrade":
      return applyFacilityUpgrade(state, teamSelection, action);
    case "assistant-coach-contract":
      return applyAssistantCoachContract(state, teamSelection, action);
    case "event-choice":''',
)

replace_once(
    "src/domain/calendar/academicYearProgression.ts",
    '''    shopEffects: undefined,
    history: {''',
    '''    shopEffects: undefined,
    schoolManagement: {
      ...state.schoolManagement,
      assistantCoach: null,
    },
    history: {''',
)

replace_once(
    "src/features/school/SchoolNavigationTabs.tsx",
    'export type SchoolView = "facilities" | "scouting" | "records" | "alumni";',
    '''export type SchoolView =
  | "facilities"
  | "staff"
  | "scouting"
  | "records"
  | "alumni";''',
)
replace_once(
    "src/features/school/SchoolNavigationTabs.tsx",
    '''const schoolViews: readonly [SchoolView, string][] = [
  ["facilities", "設備"],
  ["scouting", "スカウト"],''',
    '''const schoolViews: readonly [SchoolView, string][] = [
  ["facilities", "設備"],
  ["staff", "スタッフ"],
  ["scouting", "スカウト"],''',
)

replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''import type { SchoolReputation } from "../../domain/model/School";
import {''',
    '''import type { SchoolReputation } from "../../domain/model/School";
import type {
  AssistantCoachRank,
  AssistantCoachSpecialty,
} from "../../domain/model/SchoolManagement";
import {
  ASSISTANT_COACH_OPTIONS,
  evaluateAssistantCoachContract,
} from "../../domain/school/assistantCoach";
import {''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''interface SchoolScreenProps {
  state: GameState;
  onUpgradeFacility: (key: FacilityKey) => void;
  onOpenScouting?: () => void;
}''',
    '''interface SchoolScreenProps {
  state: GameState;
  onUpgradeFacility: (key: FacilityKey) => void;
  onContractAssistantCoach?: (
    rank: AssistantCoachRank,
    specialty: AssistantCoachSpecialty | null,
  ) => void;
  onOpenScouting?: () => void;
}''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''const reputationLabels: Record<SchoolReputation, string> = {
  unknown: "無名校",
  "district-contender": "地区有力校",
  "prefectural-power": "県内強豪",
  "national-qualifier": "全国出場校",
  "national-regular": "全国常連",
  elite: "全国名門",
};''',
    '''const reputationLabels: Record<SchoolReputation, string> = {
  unknown: "無名校",
  "district-contender": "地区有力校",
  "prefectural-power": "県内強豪",
  "national-qualifier": "全国出場校",
  "national-regular": "全国常連",
  elite: "全国名門",
};

const assistantCoachSpecialtyLabels: Record<
  AssistantCoachSpecialty,
  string
> = {
  attack: "攻撃",
  defense: "守備",
  physical: "フィジカル",
};

const assistantCoachRankLabels: Record<AssistantCoachRank, string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級",
  master: "マスター",
};''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''export function SchoolScreen({
  state,
  onUpgradeFacility,
  onOpenScouting,
}: SchoolScreenProps) {''',
    '''export function SchoolScreen({
  state,
  onUpgradeFacility,
  onContractAssistantCoach,
  onOpenScouting,
}: SchoolScreenProps) {''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''  const [fundsHistoryOpen, setFundsHistoryOpen] = useState(false);
  const school = state.schools[state.userSchoolId];''',
    '''  const [fundsHistoryOpen, setFundsHistoryOpen] = useState(false);
  const [coachSpecialties, setCoachSpecialties] = useState<
    Partial<Record<AssistantCoachRank, AssistantCoachSpecialty>>
  >({});
  const school = state.schools[state.userSchoolId];''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''  const fundsHistory = [...state.schoolManagement.fundsHistory].reverse();

  const confirmUpgrade = () => {''',
    '''  const fundsHistory = [...state.schoolManagement.fundsHistory].reverse();
  const assistantCoachContract = state.schoolManagement.assistantCoach;
  const assistantCoachContractOption = assistantCoachContract
    ? ASSISTANT_COACH_OPTIONS.find(
        (option) => option.rank === assistantCoachContract.rank,
      )
    : null;

  const confirmUpgrade = () => {''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    "            <span>最大 Lv.5</span>",
    "            <span>最大 Lv.50</span>",
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''                    <b>Lv.{evaluation.currentLevel}</b>
                  </span>
                  <small''',
    '''                    <b>Lv.{evaluation.currentLevel} / 50</b>
                  </span>
                  <progress
                    aria-label={`${definition.name} レベル進捗`}
                    className="facility-tile__progress"
                    max={50}
                    value={evaluation.currentLevel}
                  />
                  <small''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''      {view === "scouting" ? (
        <section className="school-panel school-panel--loading-scouting">''',
    '''      {view === "staff" ? (
        <section className="school-panel" aria-labelledby="staff-heading">
          <div className="school-section-heading">
            <div>
              <p className="section-kicker">年間契約</p>
              <h3 id="staff-heading">スタッフ</h3>
            </div>
            <span>年度更新で契約終了</span>
          </div>

          {assistantCoachContract && assistantCoachContractOption ? (
            <div
              className="assistant-coach-current"
              data-testid="assistant-coach-current"
            >
              <span>契約中</span>
              <strong>
                {assistantCoachRankLabels[assistantCoachContract.rank]}
                {assistantCoachContract.specialty
                  ? `・${assistantCoachSpecialtyLabels[assistantCoachContract.specialty]}`
                  : "・総合"}
              </strong>
              <small>
                {state.calendar.academicYear}年度・全体成長 +
                {assistantCoachContractOption.generalPercent - 100}%
              </small>
            </div>
          ) : (
            <p className="assistant-coach-none">現在契約中のコーチはいません</p>
          )}

          <div className="assistant-coach-grid">
            {ASSISTANT_COACH_OPTIONS.map((option) => {
              const specialty =
                option.rank === "beginner"
                  ? null
                  : (coachSpecialties[option.rank] ?? null);
              const evaluation = evaluateAssistantCoachContract(
                state,
                option.rank,
                specialty,
              );
              const missingFunds = Math.max(0, option.annualCost - school.funds);
              return (
                <article
                  className="assistant-coach-card"
                  data-testid={`assistant-coach-${option.rank}`}
                  key={option.rank}
                >
                  <div className="assistant-coach-card__heading">
                    <strong>{option.name}</strong>
                    <span>年間 {option.annualCost}</span>
                  </div>
                  <div className="assistant-coach-effects">
                    <span>全体 +{option.generalPercent - 100}%</span>
                    {option.specialtyPercent ? (
                      <span>専門 +{option.specialtyPercent - 100}%</span>
                    ) : (
                      <span>総合指導</span>
                    )}
                    {option.conditionPercent ? (
                      <span>低調子 +{option.conditionPercent - 100}%</span>
                    ) : null}
                    {option.firstYearPercent ? (
                      <span>1年生 +{option.firstYearPercent - 100}%</span>
                    ) : null}
                  </div>
                  {option.rank !== "beginner" ? (
                    <label className="assistant-coach-specialty">
                      専門
                      <select
                        aria-label={`${option.name}の専門`}
                        onChange={(event) =>
                          setCoachSpecialties((current) => ({
                            ...current,
                            [option.rank]: event.target
                              .value as AssistantCoachSpecialty,
                          }))
                        }
                        value={specialty ?? ""}
                      >
                        <option value="">選択してください</option>
                        <option value="attack">攻撃</option>
                        <option value="defense">守備</option>
                        <option value="physical">フィジカル</option>
                      </select>
                    </label>
                  ) : null}
                  <div className="assistant-coach-card__footer">
                    <small>
                      {evaluation.reason === "insufficient-funds"
                        ? `あと${missingFunds}必要`
                        : evaluation.reason === "specialty-required"
                          ? "専門を選択してください"
                          : `契約後 ${evaluation.fundsAfter}`}
                    </small>
                    <button
                      aria-label={`${option.name}と年間契約`}
                      disabled={!onContractAssistantCoach || !evaluation.allowed}
                      onClick={() =>
                        onContractAssistantCoach?.(option.rank, specialty)
                      }
                      type="button"
                    >
                      契約する
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {view === "scouting" ? (
        <section className="school-panel school-panel--loading-scouting">''',
)

replace_once(
    "src/app/GameApp.tsx",
    '''import type { SchoolReputation } from "../domain/model/School";
import type { TeamSelection } from "../domain/model/TeamSelection";''',
    '''import type { SchoolReputation } from "../domain/model/School";
import type {
  AssistantCoachRank,
  AssistantCoachSpecialty,
} from "../domain/model/SchoolManagement";
import type { TeamSelection } from "../domain/model/TeamSelection";''',
)
replace_once(
    "src/app/GameApp.tsx",
    '''  const upgradeSchoolFacility = async (key: FacilityKey) => {
    await cloudSession.runAction(
      { type: "facility-upgrade", facility: key },
      "施設を更新しています…",
    );
  };

  const markNotificationRead''',
    '''  const upgradeSchoolFacility = async (key: FacilityKey) => {
    await cloudSession.runAction(
      { type: "facility-upgrade", facility: key },
      "施設を更新しています…",
    );
  };

  const contractAssistantCoach = async (
    rank: AssistantCoachRank,
    specialty: AssistantCoachSpecialty | null,
  ) => {
    await cloudSession.runAction(
      { type: "assistant-coach-contract", rank, specialty },
      "コーチと契約しています…",
    );
  };

  const markNotificationRead''',
)
replace_once(
    "src/app/GameApp.tsx",
    '''      <SchoolScreen
        onOpenScouting={openScouting}
        onUpgradeFacility={upgradeSchoolFacility}
        state={gameState}
      />''',
    '''      <SchoolScreen
        onContractAssistantCoach={contractAssistantCoach}
        onOpenScouting={openScouting}
        onUpgradeFacility={upgradeSchoolFacility}
        state={gameState}
      />''',
)

replace_once(
    "src/features/school/school-screen.css",
    "  grid-template-columns: repeat(4, minmax(0, 1fr));",
    "  grid-template-columns: repeat(5, minmax(0, 1fr));",
)
css = Path("src/features/school/school-screen.css")
css.write_text(
    css.read_text()
    + '''

.facility-tile__progress {
  width: 100%;
  height: 5px;
  overflow: hidden;
  accent-color: #2f7885;
}

.assistant-coach-current,
.assistant-coach-none,
.assistant-coach-card {
  border: 1px solid #dce6e9;
  border-radius: 14px;
}

.assistant-coach-current {
  display: grid;
  margin-top: 12px;
  padding: 12px;
  gap: 3px;
  background: #e9f4ef;
}

.assistant-coach-current > span {
  color: #18715e;
  font-size: 0.66rem;
  font-weight: 900;
}

.assistant-coach-current > strong {
  color: #174f5c;
  font-size: 0.9rem;
}

.assistant-coach-current > small,
.assistant-coach-none {
  color: #687c85;
  font-size: 0.68rem;
}

.assistant-coach-none {
  margin: 12px 0 0;
  padding: 11px;
  background: #f5f8fa;
}

.assistant-coach-grid {
  display: grid;
  margin-top: 10px;
  gap: 8px;
}

.assistant-coach-card {
  display: grid;
  padding: 11px;
  gap: 9px;
  background: #f7fafb;
}

.assistant-coach-card__heading,
.assistant-coach-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
}

.assistant-coach-card__heading strong {
  color: #193e48;
  font-size: 0.8rem;
}

.assistant-coach-card__heading span {
  color: #315f69;
  font-size: 0.68rem;
  font-weight: 900;
}

.assistant-coach-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.assistant-coach-effects span {
  padding: 4px 6px;
  color: #47636e;
  font-size: 0.62rem;
  font-weight: 800;
  background: #e6eef1;
  border-radius: 999px;
}

.assistant-coach-specialty {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  color: #61747d;
  font-size: 0.68rem;
  font-weight: 800;
}

.assistant-coach-specialty select {
  min-width: 0;
  min-height: 36px;
  padding: 6px 8px;
  color: #193e48;
  background: #fff;
  border: 1px solid #cfdde1;
  border-radius: 9px;
}

.assistant-coach-card__footer small {
  color: #6b7c84;
  font-size: 0.64rem;
  font-weight: 800;
}

.assistant-coach-card__footer button {
  min-height: 38px;
  padding: 7px 11px;
  color: #fff;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 900;
  background: #1c6977;
  border: 0;
  border-radius: 10px;
}

.assistant-coach-card__footer button:disabled {
  color: #87979d;
  background: #e1e8ea;
}

@media (max-width: 350px) {
  .school-segments button {
    padding-inline: 2px;
    font-size: 0.58rem;
  }
}
'''
)

replace_count(
    "tests/unit/features/school/AssistantCoachStaffScreen.test.tsx",
    'getByRole("button", { name: "スタッフ" })',
    'getByRole("tab", { name: "スタッフ" })',
    3,
)
replace_once(
    "tests/unit/features/school/AssistantCoachStaffScreen.test.tsx",
    '''    expect(screen.getByText("契約中")).toBeVisible();
    expect(screen.getByText(/上級コーチ/)).toBeVisible();
    expect(screen.getByText(/攻撃/)).toBeVisible();''',
    '''    const currentContract = screen.getByTestId("assistant-coach-current");
    expect(within(currentContract).getByText("契約中")).toBeVisible();
    expect(within(currentContract).getByText(/上級/)).toBeVisible();
    expect(within(currentContract).getByText(/攻撃/)).toBeVisible();''',
)
