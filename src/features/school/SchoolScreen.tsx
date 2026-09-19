import { useMemo, useState } from "react";
import type { GameState } from "../../domain/model/GameState";
import type { SchoolReputation } from "../../domain/model/School";
import type {
  AssistantCoachRank,
  AssistantCoachSpecialty,
} from "../../domain/model/SchoolManagement";
import {
  ASSISTANT_COACH_OPTIONS,
  evaluateAssistantCoachContract,
} from "../../domain/school/assistantCoach";
import {
  FACILITY_DEFINITIONS,
  FACILITY_UPGRADE_LEVEL_OPTIONS,
  evaluateFacilityUpgrade,
  type FacilityKey,
  type FacilityUpgradeLevels,
} from "../../domain/school/facilityUpgrade";
import { reputationGrade } from "../../domain/school/reputation";
import { BottomSheet } from "../../ui/BottomSheet";
import { MobileChoiceSheet } from "../../ui/MobileChoiceSheet";
import "../../ui/ui.css";
import { buildSeasonProgressPresentation } from "../season/seasonProgressPresentation";
import { consumeSchoolViewAfterScouting } from "./SchoolNavigationState";
import { SchoolNavigationTabs, type SchoolView } from "./SchoolNavigationTabs";
import { SchoolLegacyPanel } from "./SchoolLegacyPanel";
import { SchoolSeasonHistory } from "./SchoolSeasonHistory";
import { SchoolSeasonRanking } from "./SchoolSeasonRanking";
import "./school-economy.css";
import "./school-screen.css";

type SchoolRecordView = "season" | "results" | "history";

interface SchoolScreenProps {
  state: GameState;
  onUpgradeFacility: (
    key: FacilityKey,
    levels: FacilityUpgradeLevels,
  ) => void | Promise<unknown>;
  onContractAssistantCoach?: (
    rank: AssistantCoachRank,
    specialty: AssistantCoachSpecialty | null,
  ) => void;
  onOpenScouting?: () => void;
}

const reputationLabels: Record<SchoolReputation, string> = {
  unknown: "無名校",
  "district-contender": "地区有力校",
  "prefectural-power": "県内強豪",
  "national-qualifier": "全国出場校",
  "national-regular": "全国常連",
  elite: "全国名門",
};

const assistantCoachSpecialtyLabels: Record<AssistantCoachSpecialty, string> = {
  attack: "攻撃",
  defense: "守備",
  physical: "フィジカル",
};

const assistantCoachRankLabels: Record<AssistantCoachRank, string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級",
  master: "マスター",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatFundsAmount(amount: number): string {
  const absolute = Math.abs(amount).toLocaleString("ja-JP");
  return amount >= 0 ? `+${absolute}` : `-${absolute}`;
}

function facilityActionLabel(
  name: string,
  reason: ReturnType<typeof evaluateFacilityUpgrade>["reason"],
): string {
  if (reason === "available") return `${name}を強化`;
  if (reason === "max-level") return `${name}は最大レベル`;
  if (reason === "insufficient-funds") return `${name}は資金不足`;
  return `${name}は強化不可`;
}

export function SchoolScreen({
  state,
  onUpgradeFacility,
  onContractAssistantCoach,
  onOpenScouting,
}: SchoolScreenProps) {
  const [view, setView] = useState<SchoolView>(consumeSchoolViewAfterScouting);
  const [recordView, setRecordView] = useState<SchoolRecordView>("season");
  const [selectedFacility, setSelectedFacility] = useState<FacilityKey | null>(
    null,
  );
  const [selectedUpgradeLevels, setSelectedUpgradeLevels] =
    useState<FacilityUpgradeLevels>(1);
  const [facilityUpgradePending, setFacilityUpgradePending] = useState(false);
  const [fundsHistoryOpen, setFundsHistoryOpen] = useState(false);
  const [coachSpecialties, setCoachSpecialties] = useState<
    Partial<Record<AssistantCoachRank, AssistantCoachSpecialty>>
  >({});
  const school = state.schools[state.userSchoolId];

  const recentMatches = useMemo(() => {
    if (!school) return [];
    return state.history.matches
      .filter(
        (match) =>
          match.homeSchoolId === school.id || match.awaySchoolId === school.id,
      )
      .filter((match) => {
        const opponentId =
          match.homeSchoolId === school.id
            ? match.awaySchoolId
            : match.homeSchoolId;
        return Boolean(state.schools[opponentId]);
      })
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 5);
  }, [school, state.history.matches, state.schools]);

  if (!school) {
    return (
      <main className="app-content school-screen">
        <section className="school-error" role="alert">
          自校データを読み込めませんでした。
        </section>
      </main>
    );
  }

  const graduates = state.history.graduates.filter(
    (graduate) => graduate.schoolId === school.id,
  );
  const selectedDefinition = selectedFacility
    ? FACILITY_DEFINITIONS.find(
        (definition) => definition.key === selectedFacility,
      )
    : null;
  const selectedEvaluation = selectedFacility
    ? evaluateFacilityUpgrade(
        state,
        school.id,
        selectedFacility,
        selectedUpgradeLevels,
      )
    : null;
  const fundsHistory = [...state.schoolManagement.fundsHistory].reverse();
  const assistantCoachContract = state.schoolManagement.assistantCoach;
  const assistantCoachContractOption = assistantCoachContract
    ? ASSISTANT_COACH_OPTIONS.find(
        (option) => option.rank === assistantCoachContract.rank,
      )
    : null;
  const seasonProgress = buildSeasonProgressPresentation(state);

  const confirmUpgrade = async () => {
    if (
      facilityUpgradePending ||
      !selectedFacility ||
      !selectedEvaluation?.allowed
    ) {
      return;
    }
    setFacilityUpgradePending(true);
    try {
      await onUpgradeFacility(selectedFacility, selectedUpgradeLevels);
    } finally {
      setFacilityUpgradePending(false);
    }
  };

  const selectView = (nextView: SchoolView) => {
    setView(nextView);
    if (nextView === "scouting") onOpenScouting?.();
  };

  return (
    <main className="app-content school-screen">
      <section
        className="school-hero school-hero--compact"
        data-testid="school-hero"
      >
        <div className="school-hero__title">
          <p className="section-kicker">学校運営</p>
          <h2>学校</h2>
        </div>
        <div
          aria-label="学校サマリー"
          className="school-overview-grid"
          role="region"
        >
          <article aria-label="評判">
            <span>評判</span>
            <strong>
              {reputationGrade(school.reputationPoints)}{" "}
              {school.reputationPoints}
            </strong>
            <small>{reputationLabels[school.reputation]}</small>
          </article>
          <button
            aria-label={`資金 ${school.funds}・履歴を表示`}
            className="school-overview-card school-overview-card--button"
            onClick={() => setFundsHistoryOpen(true)}
            type="button"
          >
            <span>資金</span>
            <strong>{school.funds}</strong>
            <small>履歴を見る</small>
          </button>
          <article aria-label="県内順位">
            <span>県内</span>
            <strong>
              {seasonProgress ? `${seasonProgress.regional.rank}位` : "--"}
            </strong>
            <small>
              {seasonProgress
                ? `/${seasonProgress.regional.total}校`
                : "順位未集計"}
            </small>
          </article>
          <article aria-label="全国順位">
            <span>全国</span>
            <strong>
              {seasonProgress ? `${seasonProgress.national.rank}位` : "--"}
            </strong>
            <small>
              {seasonProgress
                ? `/${seasonProgress.national.total}校`
                : "順位未集計"}
            </small>
          </article>
        </div>
      </section>

      <SchoolNavigationTabs activeView={view} onSelect={selectView} />

      {view === "management" ? (
        <section className="school-panel" aria-labelledby="management-heading">
          <div className="school-section-heading">
            <div>
              <p className="section-kicker">学校運営</p>
              <h3 id="management-heading">運営</h3>
            </div>
            <span>設備・スタッフ</span>
          </div>

          <section
            className="school-management-section"
            aria-labelledby="facility-heading"
          >
            <div className="school-subsection-heading">
              <div>
                <h4 id="facility-heading">設備</h4>
                <small>学校の育成環境を強化</small>
              </div>
              <span>最大 Lv.50</span>
            </div>
            <div className="facility-grid">
              {FACILITY_DEFINITIONS.map((definition) => {
                const evaluation = evaluateFacilityUpgrade(
                  state,
                  school.id,
                  definition.key,
                );
                const missingFunds = Math.max(
                  0,
                  evaluation.cost - school.funds,
                );
                const status =
                  evaluation.reason === "max-level"
                    ? "最大Lv"
                    : evaluation.reason === "insufficient-funds"
                      ? `あと${missingFunds}必要`
                      : evaluation.reason === "invalid-level"
                        ? "要確認"
                        : `次 ${evaluation.cost}`;
                return (
                  <button
                    aria-label={`${definition.name}の詳細`}
                    className="facility-tile"
                    data-testid="facility-tile"
                    key={definition.key}
                    onClick={() => {
                      setSelectedFacility(definition.key);
                      setSelectedUpgradeLevels(1);
                    }}
                    type="button"
                  >
                    <span className="facility-tile__top">
                      <strong>{definition.name}</strong>
                      <b>Lv.{evaluation.currentLevel} / 50</b>
                    </span>
                    <progress
                      aria-label={`${definition.name} レベル進捗`}
                      className="facility-tile__progress"
                      max={50}
                      value={evaluation.currentLevel}
                    />
                    <small
                      className={
                        evaluation.allowed
                          ? undefined
                          : "facility-tile__warning"
                      }
                    >
                      {status}
                    </small>
                    <span className="facility-tile__detail" aria-hidden="true">
                      詳細 ›
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className="school-management-section"
            aria-labelledby="staff-heading"
          >
            <div className="school-subsection-heading">
              <div>
                <h4 id="staff-heading">スタッフ</h4>
                <small>年間コーチ契約</small>
              </div>
              <span>年度更新で終了</span>
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
              <p className="assistant-coach-none">
                現在契約中のコーチはいません
              </p>
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
                const missingFunds = Math.max(
                  0,
                  option.annualCost - school.funds,
                );
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
                      <MobileChoiceSheet
                        ariaLabel={`${option.name}の専門`}
                        className="assistant-coach-specialty"
                        label="専門"
                        layout="grid"
                        onChange={(value) =>
                          setCoachSpecialties((current) => {
                            const next = { ...current };
                            if (value) {
                              next[option.rank] =
                                value as AssistantCoachSpecialty;
                            } else {
                              delete next[option.rank];
                            }
                            return next;
                          })
                        }
                        options={[
                          { value: "", label: "未選択" },
                          { value: "attack", label: "攻撃" },
                          { value: "defense", label: "守備" },
                          { value: "physical", label: "フィジカル" },
                        ]}
                        title={`${option.name}の専門を選ぶ`}
                        value={specialty ?? ""}
                      />
                    ) : null}
                    <div className="assistant-coach-card__footer">
                      <small>
                        {evaluation.reason === "insufficient-funds"
                          ? `あと${missingFunds}必要`
                          : evaluation.reason === "specialty-required"
                            ? "専門を選択してください"
                            : evaluation.reason ===
                                "already-contracted-this-year"
                              ? "今年度は契約済み"
                              : evaluation.reason === "specialty-not-allowed"
                                ? "専門指定なしで契約してください"
                                : `契約後 ${evaluation.fundsAfter}`}
                      </small>
                      <button
                        aria-label={`${option.name}と年間契約`}
                        disabled={
                          !onContractAssistantCoach || !evaluation.allowed
                        }
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
        </section>
      ) : null}

      {view === "scouting" ? (
        <section className="school-panel school-panel--loading-scouting">
          <p className="school-empty-state">スカウト候補を読み込んでいます…</p>
        </section>
      ) : null}

      {view === "records" ? (
        <section className="school-panel" aria-labelledby="record-heading">
          <div className="school-section-heading">
            <div>
              <p className="section-kicker">記録</p>
              <h3 id="record-heading">学校記録</h3>
            </div>
          </div>

          <div
            aria-label="学校記録メニュー"
            className="school-record-tabs"
            role="tablist"
          >
            {(
              [
                ["season", "今季"],
                ["results", "戦績"],
                ["history", "歴史"],
              ] as const
            ).map(([id, label]) => (
              <button
                aria-selected={recordView === id}
                className={
                  recordView === id ? "school-record-tab--active" : undefined
                }
                key={id}
                onClick={() => setRecordView(id)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {recordView === "season" ? (
            seasonProgress ? (
              <SchoolSeasonRanking presentation={seasonProgress} />
            ) : (
              <p className="school-empty-state">今季の記録はまだありません</p>
            )
          ) : null}

          {recordView === "results" ? (
            <div
              className="school-record-content"
              data-testid="school-record-results"
            >
              <div className="school-record-grid">
                <span>
                  公式戦勝利<strong>{school.history.officialWins}</strong>
                </span>
                <span>
                  公式戦敗北<strong>{school.history.officialLosses}</strong>
                </span>
                <span>
                  県大会優勝<strong>{school.history.prefecturalTitles}</strong>
                </span>
                <span>
                  全国出場<strong>{school.history.nationalAppearances}</strong>
                </span>
                <span>
                  全国優勝<strong>{school.history.nationalTitles}</strong>
                </span>
              </div>
              <h4>直近の試合</h4>
              {recentMatches.length === 0 ? (
                <p className="school-empty-state">試合記録はまだありません</p>
              ) : (
                <div className="school-match-list">
                  {recentMatches.map((match) => {
                    const home = match.homeSchoolId === school.id;
                    const opponentId = home
                      ? match.awaySchoolId
                      : match.homeSchoolId;
                    const opponent = state.schools[opponentId]!;
                    const userSets = home
                      ? match.homeSetsWon
                      : match.awaySetsWon;
                    const opponentSets = home
                      ? match.awaySetsWon
                      : match.homeSetsWon;
                    const won = match.winnerSchoolId === school.id;
                    return (
                      <article
                        className="school-match-record"
                        data-testid="school-match-record"
                        key={match.matchId}
                      >
                        <div>
                          <time>{formatDate(match.date)}</time>
                          <strong>{opponent.name}</strong>
                        </div>
                        <span
                          className={
                            won ? "school-result--win" : "school-result--loss"
                          }
                        >
                          {won ? "勝利" : "敗戦"} {userSets} - {opponentSets}
                        </span>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {recordView === "history" ? (
            <div
              className="school-record-content"
              data-testid="school-record-history"
            >
              {seasonProgress ? (
                <>
                  <SchoolLegacyPanel presentation={seasonProgress.legacy} />
                  <SchoolSeasonHistory
                    presentations={seasonProgress.archivedSeasons}
                  />
                </>
              ) : null}

              <section
                className="school-alumni-section"
                aria-labelledby="alumni-heading"
              >
                <div className="school-subsection-heading">
                  <div>
                    <h4 id="alumni-heading">卒業生記録</h4>
                    <small>学校を巣立った選手</small>
                  </div>
                  <span>{graduates.length}人</span>
                </div>
                {graduates.length === 0 ? (
                  <p className="school-empty-state">
                    卒業生の記録はまだありません
                  </p>
                ) : (
                  <div className="alumni-list">
                    {graduates.map((graduate) => (
                      <article
                        key={`${graduate.playerId}-${graduate.graduationYear}`}
                      >
                        <div>
                          <strong>{graduate.displayName}</strong>
                          <span>
                            {graduate.graduationYear}年卒・{graduate.position}
                          </span>
                        </div>
                        <div className="alumni-metrics">
                          <span>出場 {graduate.appearances}</span>
                          <span>得点 {graduate.points}</span>
                          <span>ブロック {graduate.blocks}</span>
                          <span>サービスエース {graduate.serviceAces}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </section>
      ) : null}

      <BottomSheet
        description="学校運営資金の入出金履歴です。"
        onClose={() => setFundsHistoryOpen(false)}
        open={fundsHistoryOpen}
        title="資金履歴"
      >
        {fundsHistory.length === 0 ? (
          <p className="school-empty-state">資金履歴はまだありません</p>
        ) : (
          <div className="funds-ledger">
            {fundsHistory.map((entry) => (
              <article
                className="funds-ledger__entry"
                data-testid="funds-ledger-entry"
                key={entry.id}
              >
                <div>
                  <strong>{entry.label}</strong>
                  <time>{formatDate(entry.gameDate)}</time>
                </div>
                <div className="funds-ledger__amounts">
                  <strong
                    className={
                      entry.amount >= 0
                        ? "funds-ledger__amount--positive"
                        : "funds-ledger__amount--negative"
                    }
                  >
                    {formatFundsAmount(entry.amount)}
                  </strong>
                  <span>残高 {entry.balanceAfter.toLocaleString("ja-JP")}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        description="資金があれば1・5・10レベル単位でまとめて強化できます。費用は各レベル分の合計です。"
        onClose={() => setSelectedFacility(null)}
        open={Boolean(selectedDefinition && selectedEvaluation)}
        title="設備を強化"
      >
        {selectedDefinition && selectedEvaluation ? (
          <div className="facility-confirmation">
            <strong>{selectedDefinition.name}</strong>
            <p className="facility-confirmation__description">
              {selectedDefinition.description}
            </p>
            <div
              aria-label="強化レベルを選択"
              className="facility-upgrade-options"
              role="group"
            >
              {FACILITY_UPGRADE_LEVEL_OPTIONS.map((levels) => {
                const optionEvaluation = evaluateFacilityUpgrade(
                  state,
                  school.id,
                  selectedDefinition.key,
                  levels,
                );
                return (
                  <button
                    aria-pressed={selectedUpgradeLevels === levels}
                    className={
                      selectedUpgradeLevels === levels
                        ? "facility-upgrade-option facility-upgrade-option--selected"
                        : "facility-upgrade-option"
                    }
                    disabled={
                      !optionEvaluation.allowed || facilityUpgradePending
                    }
                    key={levels}
                    onClick={() => setSelectedUpgradeLevels(levels)}
                    type="button"
                  >
                    <strong>+{levels} Lv</strong>
                    <small>
                      {optionEvaluation.reason === "max-level"
                        ? "上限超過"
                        : optionEvaluation.reason === "insufficient-funds"
                          ? `${optionEvaluation.cost}・資金不足`
                          : `${optionEvaluation.cost}`}
                    </small>
                  </button>
                );
              })}
            </div>
            <p className="facility-confirmation__level">
              Lv.{selectedEvaluation.currentLevel} → Lv.
              {selectedEvaluation.nextLevel}
            </p>
            <dl>
              <div>
                <dt>必要資金</dt>
                <dd>{selectedEvaluation.cost}</dd>
              </div>
              <div>
                <dt>強化後の資金</dt>
                <dd>{selectedEvaluation.fundsAfter}</dd>
              </div>
            </dl>
            <button
              aria-label={
                selectedEvaluation.allowed
                  ? undefined
                  : facilityActionLabel(
                      selectedDefinition.name,
                      selectedEvaluation.reason,
                    )
              }
              className="primary-action"
              disabled={facilityUpgradePending || !selectedEvaluation.allowed}
              onClick={() => void confirmUpgrade()}
              type="button"
            >
              {facilityUpgradePending
                ? "強化中…"
                : `+${selectedUpgradeLevels} Lv・${selectedEvaluation.cost}を使って強化`}
            </button>
          </div>
        ) : null}
      </BottomSheet>
    </main>
  );
}
