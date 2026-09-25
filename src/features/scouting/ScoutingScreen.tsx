import { useMemo, useState } from "react";
import type { GameState } from "../../domain/model/GameState";
import type { PlayerId } from "../../domain/model/identifiers";
import { scoutingBaseSearchesRemaining } from "../../domain/scouting/scoutingSearchBudget";
import type { ScoutingSearchCriteria } from "../../domain/scouting/scoutingSearchCriteria";
import {
  recruitmentRecommendationAvailable,
  recruitmentVisitsRemaining,
  type RecruitmentAction,
} from "../../domain/scouting/recruitmentEngagement";
import { reputationGrade } from "../../domain/school/reputation";
import type {
  MiddleSchoolAchievement,
  ScoutConfidence,
  ScoutReport,
} from "../../domain/scouting/scoutReport";
import { getSpecialAbilityDefinition } from "../../domain/player/specialAbilities";
import type { ShopItemId } from "../../domain/shop/shopCatalog";
import type {
  ShopStatusResponse,
  ShopUseTarget,
} from "../../domain/shop/shopContracts";
import { requestSchoolViewAfterScouting } from "../school/SchoolNavigationState";
import {
  SchoolNavigationTabs,
  type SchoolView,
} from "../school/SchoolNavigationTabs";
import type { ShopUsePresentation } from "../shop/shopUsePresentation";
import { BottomSheet } from "../../ui/BottomSheet";
import "./scouting.css";

interface ScoutingScreenProps {
  state: GameState;
  reports: ScoutReport[];
  loading: boolean;
  error: string | null;
  recruitingCandidateId: PlayerId | null;
  recruitingAction?: RecruitmentAction | null;
  shopStatus?: ShopStatusResponse | null;
  shopPendingItemId?: ShopItemId | null;
  shopPendingCandidateId?: string | null;
  latestShopUseResult?: ShopUsePresentation | null;
  onBack: () => void;
  onRetry: () => void;
  onSearch?: (criteria: ScoutingSearchCriteria) => void;
  onRecruit: (candidateId: PlayerId, action?: RecruitmentAction) => void;
  onUseShopItem?: (itemId: ShopItemId, target: ShopUseTarget) => void;
}

const achievementLabels: Record<MiddleSchoolAchievement, string> = {
  unknown: "実績不明",
  "regional-starter": "地区大会主力",
  "prefectural-best-eight": "県ベスト8",
  "prefectural-selection": "県選抜",
  "national-event": "全国大会経験",
};

const confidenceLabels: Record<ScoutConfidence, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

const handednessLabels = {
  right: "右利き",
  left: "左利き",
} as const;

const estimatedAbilityLabels = [
  ["attack", "攻"],
  ["defense", "守"],
  ["jump", "跳"],
  ["stamina", "体"],
  ["mental", "心"],
] as const;

function stars(value: ScoutReport["evaluationStars"]): string {
  return `${"★".repeat(value)}${"☆".repeat(5 - value)}`;
}

function estimatedAbilities(report: ScoutReport) {
  const fallback = report.estimatedOverall;
  return (
    report.estimatedAbilities ?? {
      attack: fallback,
      defense: fallback,
      jump: fallback,
      stamina: fallback,
      mental: fallback,
    }
  );
}

function currentCycleKey(state: GameState): string {
  return `${state.userSchoolId}:year-${state.yearIndex}`;
}

function excludedStorageKey(cycleKey: string): string {
  return `court-legacy:scouting-excluded:${cycleKey}`;
}

function readExcludedCandidateIds(cycleKey: string): Set<PlayerId> {
  if (typeof window === "undefined") return new Set<PlayerId>();
  try {
    const raw = window.localStorage.getItem(excludedStorageKey(cycleKey));
    if (!raw) return new Set<PlayerId>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<PlayerId>();
    return new Set(
      parsed.filter((value): value is PlayerId => typeof value === "string"),
    );
  } catch {
    return new Set<PlayerId>();
  }
}

function persistExcludedCandidateIds(
  cycleKey: string,
  candidateIds: ReadonlySet<PlayerId>,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      excludedStorageKey(cycleKey),
      JSON.stringify([...candidateIds]),
    );
  } catch {
    // Exclusions are a presentation preference; gameplay remains usable without storage.
  }
}

function ScoutingShopUseResult({
  presentation,
}: {
  presentation: ShopUsePresentation;
}) {
  if (
    presentation.itemId !== "scout-research" &&
    presentation.itemId !== "potential-appraisal"
  ) {
    return null;
  }
  const before = presentation.beforeScoutReport;
  const after = presentation.afterScoutReport;
  if (!before || !after) return null;

  return (
    <section className="scouting-shop-result" aria-live="polite">
      <h2>
        {presentation.itemId === "scout-research"
          ? "スカウト再調査の結果"
          : "潜在能力鑑定の結果"}
      </h2>
      <div className="scouting-shop-result__metrics">
        <span>
          現在能力 {before.estimatedOverall.min}〜{before.estimatedOverall.max}{" "}
          → {after.estimatedOverall.min}〜{after.estimatedOverall.max}
        </span>
        <span>
          将来性 {before.estimatedPotential.min}〜
          {before.estimatedPotential.max} → {after.estimatedPotential.min}〜
          {after.estimatedPotential.max}
        </span>
        <span>
          調査精度 {confidenceLabels[before.confidence]} →{" "}
          {confidenceLabels[after.confidence]}
        </span>
      </div>
    </section>
  );
}

export function ScoutingScreen({
  state,
  reports,
  loading,
  error,
  recruitingCandidateId,
  recruitingAction = null,
  shopStatus = null,
  shopPendingItemId = null,
  shopPendingCandidateId = null,
  latestShopUseResult = null,
  onBack,
  onRetry,
  onSearch = () => undefined,
  onRecruit,
  onUseShopItem = () => undefined,
}: ScoutingScreenProps) {
  const school = state.schools[state.userSchoolId]!;
  const cycleKey = currentCycleKey(state);
  const [negotiatingCandidateId, setNegotiatingCandidateId] =
    useState<PlayerId | null>(null);
  const [excludedState, setExcludedState] = useState<{
    cycleKey: string;
    candidateIds: Set<PlayerId>;
  }>(() => ({
    cycleKey,
    candidateIds: readExcludedCandidateIds(cycleKey),
  }));
  const excludedCandidateIds =
    excludedState.cycleKey === cycleKey
      ? excludedState.candidateIds
      : readExcludedCandidateIds(cycleKey);

  const committedCandidateIds =
    state.recruiting?.cycleKey === cycleKey
      ? state.recruiting.committedCandidateIds
      : [];
  const committed = new Set<PlayerId>(committedCandidateIds);
  const researchStatus = shopStatus?.items.find(
    (item) => item.itemId === "scout-research",
  );
  const appraisalStatus = shopStatus?.items.find(
    (item) => item.itemId === "potential-appraisal",
  );
  const activeReports = useMemo(
    () =>
      reports.filter((report) => !excludedCandidateIds.has(report.candidateId)),
    [excludedCandidateIds, reports],
  );
  const excludedReports = useMemo(
    () =>
      reports.filter((report) => excludedCandidateIds.has(report.candidateId)),
    [excludedCandidateIds, reports],
  );
  const negotiatingReport =
    reports.find((report) => report.candidateId === negotiatingCandidateId) ??
    null;
  const visitsRemaining = recruitmentVisitsRemaining(state);
  const recommendationAvailable = recruitmentRecommendationAvailable(state);
  const baseSearchesRemaining = scoutingBaseSearchesRemaining(state);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [searchRegion, setSearchRegion] = useState<"prefecture" | "regional" | "national">("prefecture");
  const [searchPosition, setSearchPosition] = useState<"any" | "OH" | "MB" | "S" | "OP" | "L">("any");
  const [searchPriority, setSearchPriority] = useState<"ability" | "potential" | "physical" | "immediate" | "hidden">("ability");

  const selectSchoolView = (view: SchoolView) => {
    if (view === "scouting") return;
    requestSchoolViewAfterScouting(view);
    onBack();
  };

  const setCandidateExcluded = (candidateId: PlayerId, excluded: boolean) => {
    setExcludedState((current) => {
      const currentIds =
        current.cycleKey === cycleKey
          ? current.candidateIds
          : readExcludedCandidateIds(cycleKey);
      const next = new Set(currentIds);
      if (excluded) next.add(candidateId);
      else next.delete(candidateId);
      persistExcludedCandidateIds(cycleKey, next);
      return { cycleKey, candidateIds: next };
    });
  };

  return (
    <main className="scouting-screen app-content">
      <section className="scouting-hero">
        <button
          className="scouting-back"
          onClick={onBack}
          type="button"
          aria-label="学校へ戻る"
        >
          ← 学校へ戻る
        </button>
        <div className="scouting-hero__heading">
          <div>
            <span className="section-kicker">新入生スカウト</span>
            <h1>新入生スカウト</h1>
            <p>見えている情報だけを材料に、来年度の戦力候補を見極めます。</p>
          </div>
          <strong className="scouting-grade">
            評判 {reputationGrade(school.reputationPoints)}
          </strong>
        </div>
        <div className="scouting-summary" aria-label="スカウト状況">
          <div>
            <span>今年の探索</span>
            <strong>{3 - baseSearchesRemaining}/3</strong>
          </div>
          <div>
            <span>スカウト網</span>
            <strong>Lv.{school.facilities.scoutingNetwork}</strong>
          </div>
          <div>
            <span>獲得人数</span>
            <strong>{committedCandidateIds.length}人</strong>
          </div>
          <div>
            <span>学校訪問</span>
            <strong>残{visitsRemaining}回</strong>
          </div>
          <div>
            <span>推薦枠</span>
            <strong>{recommendationAvailable ? "残1" : "使用済"}</strong>
          </div>
        </div>
      </section>

      <SchoolNavigationTabs activeView="scouting" onSelect={selectSchoolView} />

      <section className="scouting-search-launch" aria-label="選手探索">
        <div>
          <span>通常スカウト</span>
          <strong>残り {baseSearchesRemaining}/3回</strong>
        </div>
        <button onClick={() => setSearchSheetOpen(true)} type="button">
          スカウトに行く
        </button>
      </section>

      {loading ? (
        <section className="scouting-state" role="status">
          <span className="scouting-spinner" aria-hidden="true" />
          <div>
            <strong>候補を調査しています…</strong>
            <p>中学での実績やプレー評価をまとめています。</p>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="scouting-error" role="alert">
          <strong>{error}</strong>
          <button onClick={onRetry} type="button">
            再試行
          </button>
        </section>
      ) : null}

      {latestShopUseResult ? (
        <ScoutingShopUseResult presentation={latestShopUseResult} />
      ) : null}

      {!loading && activeReports.length > 0 ? (
        <section className="scouting-list" aria-label="スカウト候補一覧">
          {activeReports.map((report) => {
            const isCommitted = committed.has(report.candidateId);
            const isRecruiting = recruitingCandidateId === report.candidateId;
            const hasCompetition =
              (report.recruitment?.competitorSchoolNames.length ?? 0) > 0;
            const buttonLabel = isCommitted
              ? "獲得済み"
              : isRecruiting
                ? recruitingAction === "visit"
                  ? "訪問中…"
                  : recruitingAction === "recommendation"
                    ? "推薦交渉中…"
                    : "入学交渉中…"
                : hasCompetition
                  ? "入学交渉"
                  : "獲得候補にする";
            const researchPending =
              shopPendingItemId === "scout-research" &&
              shopPendingCandidateId === report.candidateId;
            const appraisalPending =
              shopPendingItemId === "potential-appraisal" &&
              shopPendingCandidateId === report.candidateId;
            const researchAvailable =
              Boolean(researchStatus?.canUse) &&
              (researchStatus?.quantityOwned ?? 0) > 0;
            const appraisalAvailable =
              Boolean(appraisalStatus?.canUse) &&
              (appraisalStatus?.quantityOwned ?? 0) > 0;
            const abilityEstimates = estimatedAbilities(report);
            const observedSpecialAbilities = (
              report.observedSpecialAbilityIds ?? []
            )
              .map((abilityId) => getSpecialAbilityDefinition(abilityId))
              .filter((ability) => ability !== undefined);

            return (
              <article
                className="scouting-card"
                data-testid="scouting-candidate-card"
                key={report.candidateId}
              >
                <div className="scouting-card__topline">
                  <div className="scouting-card__identity">
                    <span className="scouting-position">{report.position}</span>
                    <div>
                      <h2>{report.displayName}</h2>
                      <p>
                        {report.heightCm}cm・
                        {handednessLabels[report.handedness]}
                      </p>
                    </div>
                  </div>
                  <span
                    className="scouting-stars"
                    aria-label={`評価 ${report.evaluationStars}つ星`}
                  >
                    {stars(report.evaluationStars)}
                  </span>
                </div>

                <div className="scouting-tags">
                  <span>
                    {achievementLabels[report.middleSchoolAchievement]}
                  </span>
                  <span>調査精度 {confidenceLabels[report.confidence]}</span>
                  {report.recruitment ? (
                    <span
                      className={`scouting-interest scouting-interest--${report.recruitment.interestLevel}`}
                    >
                      志望度 {report.recruitment.interestScore}
                    </span>
                  ) : null}
                  {(report.recruitment?.competitorSchoolNames.length ?? 0) >
                  0 ? (
                    <span className="scouting-competition">
                      競合 {report.recruitment!.competitorSchoolNames.length}校
                    </span>
                  ) : null}
                </div>

                <div className="scouting-estimates">
                  <div>
                    <span>総合</span>
                    <strong>
                      {report.estimatedOverall.min}〜
                      {report.estimatedOverall.max}
                    </strong>
                  </div>
                  <div>
                    <span>将来</span>
                    <strong>
                      {report.estimatedPotential.min}〜
                      {report.estimatedPotential.max}
                    </strong>
                  </div>
                </div>

                <div
                  aria-label={`${report.displayName} 推定能力`}
                  className="scouting-ability-estimates"
                >
                  {estimatedAbilityLabels.map(([key, label]) => {
                    const range = abilityEstimates[key];
                    return (
                      <span
                        aria-label={`${label} 推定 ${range.min}〜${range.max}`}
                        key={key}
                      >
                        <small>{label}</small>
                        <strong>
                          {range.min}〜{range.max}
                        </strong>
                      </span>
                    );
                  })}
                </div>

                {report.specialAbilityCoverage &&
                report.specialAbilityCoverage !== "unknown" ? (
                  <div
                    aria-label={`${report.displayName} 確認特殊能力`}
                    className="scouting-special-abilities"
                  >
                    <span className="scouting-special-abilities__label">
                      {report.specialAbilityCoverage === "complete"
                        ? "特能 確認済"
                        : "特能 一部判明"}
                    </span>
                    <div className="scouting-special-abilities__list">
                      {observedSpecialAbilities.length > 0 ? (
                        observedSpecialAbilities.map((ability) => (
                          <span data-kind={ability.kind} key={ability.id}>
                            {ability.name}
                          </span>
                        ))
                      ) : (
                        <span data-kind="none">特殊能力なし</span>
                      )}
                    </div>
                  </div>
                ) : null}

                <ul className="scouting-comments">
                  {report.comments.map((comment) => (
                    <li key={comment}>{comment}</li>
                  ))}
                </ul>

                {researchAvailable || appraisalAvailable ? (
                  <div
                    aria-label="所持アイテム"
                    className="scouting-shop-actions"
                    role="region"
                  >
                    <span className="scouting-shop-actions__label">
                      所持アイテムを使用
                    </span>
                    <div className="scouting-shop-actions__buttons">
                      {researchAvailable ? (
                        <button
                          aria-label={`スカウト再調査 ${report.displayName}`}
                          className="scouting-shop-actions__button"
                          disabled={shopPendingItemId !== null}
                          onClick={() =>
                            onUseShopItem("scout-research", {
                              type: "scouting-candidate",
                              candidateId: report.candidateId,
                            })
                          }
                          type="button"
                        >
                          <span>
                            {researchPending
                              ? "効果を反映中…"
                              : "スカウト再調査"}
                          </span>
                          <small>
                            所持 {researchStatus?.quantityOwned ?? 0}
                          </small>
                        </button>
                      ) : null}
                      {appraisalAvailable ? (
                        <button
                          aria-label={`潜在能力鑑定 ${report.displayName}`}
                          className="scouting-shop-actions__button"
                          disabled={shopPendingItemId !== null}
                          onClick={() =>
                            onUseShopItem("potential-appraisal", {
                              type: "scouting-candidate",
                              candidateId: report.candidateId,
                            })
                          }
                          type="button"
                        >
                          <span>
                            {appraisalPending
                              ? "効果を反映中…"
                              : "潜在能力鑑定"}
                          </span>
                          <small>
                            所持 {appraisalStatus?.quantityOwned ?? 0}
                          </small>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="scouting-candidate-actions">
                  <button
                    aria-label={`対象外 ${report.displayName}`}
                    className="scouting-exclude"
                    disabled={isCommitted || isRecruiting}
                    onClick={() =>
                      setCandidateExcluded(report.candidateId, true)
                    }
                    type="button"
                  >
                    対象外
                  </button>
                  <button
                    aria-label={`${buttonLabel} ${report.displayName}`}
                    className="scouting-recruit"
                    disabled={
                      isCommitted ||
                      isRecruiting ||
                      recruitingCandidateId !== null
                    }
                    onClick={() => {
                      if (hasCompetition) {
                        setNegotiatingCandidateId(report.candidateId);
                        return;
                      }
                      onRecruit(report.candidateId, "commit");
                    }}
                    type="button"
                  >
                    {buttonLabel}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {!loading && reports.length > 0 && activeReports.length === 0 ? (
        <p className="scouting-empty-active">表示中の候補はいません</p>
      ) : null}

      <BottomSheet
        description="地域・ポジション・探したいタイプを選択"
        onClose={() => setSearchSheetOpen(false)}
        open={searchSheetOpen}
        title="探索条件"
      >
        <div className="scouting-search-sheet">
          <fieldset>
            <legend>地域</legend>
            <div className="scouting-search-chips">
              {([["prefecture", "県内"], ["regional", "地方"], ["national", "全国"]] as const).map(([value, label]) => (
                <button aria-pressed={searchRegion === value} key={value} onClick={() => setSearchRegion(value)} type="button">{label}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>ポジション</legend>
            <div className="scouting-search-chips scouting-search-chips--positions">
              {(["any", "OH", "MB", "S", "OP", "L"] as const).map((value) => (
                <button aria-pressed={searchPosition === value} key={value} onClick={() => setSearchPosition(value)} type="button">{value === "any" ? "指定なし" : value}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>重視するタイプ</legend>
            <div className="scouting-search-chips scouting-search-chips--priority">
              {([["ability", "現在能力"], ["potential", "将来性"], ["physical", "身長・身体能力"], ["immediate", "即戦力"], ["hidden", "隠れた逸材"]] as const).map(([value, label]) => (
                <button aria-pressed={searchPriority === value} key={value} onClick={() => setSearchPriority(value)} type="button">{label}</button>
              ))}
            </div>
          </fieldset>
          <button className="scouting-search-confirm" disabled={baseSearchesRemaining <= 0 || loading} onClick={() => {
            onSearch({ region: searchRegion, position: searchPosition, priority: searchPriority });
            setSearchSheetOpen(false);
          }} type="button">
            {baseSearchesRemaining > 0 ? `この条件で探索する・残${baseSearchesRemaining}回` : "通常探索を使い切りました"}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        description={
          negotiatingReport?.recruitment
            ? `競合: ${negotiatingReport.recruitment.competitorSchoolNames.join(" / ")}`
            : undefined
        }
        onClose={() => setNegotiatingCandidateId(null)}
        open={Boolean(negotiatingReport)}
        title={
          negotiatingReport
            ? `${negotiatingReport.displayName}の入学交渉`
            : "入学交渉"
        }
      >
        {negotiatingReport?.recruitment ? (
          <div className="scouting-negotiation">
            <div className="scouting-negotiation__interest">
              <span>現在の志望度</span>
              <strong>{negotiatingReport.recruitment.interestScore}</strong>
              <small>
                {negotiatingReport.recruitment.canCommit
                  ? "入学確約を取れる状態です"
                  : "志望度60で入学確約できます"}
              </small>
            </div>
            <div className="scouting-negotiation__actions">
              <button
                disabled={
                  visitsRemaining <= 0 || recruitingCandidateId !== null
                }
                onClick={() => {
                  onRecruit(negotiatingReport.candidateId, "visit");
                  setNegotiatingCandidateId(null);
                }}
                type="button"
              >
                <strong>学校訪問</strong>
                <small>志望度 +12・残{visitsRemaining}回</small>
              </button>
              <button
                disabled={
                  !recommendationAvailable || recruitingCandidateId !== null
                }
                onClick={() => {
                  onRecruit(negotiatingReport.candidateId, "recommendation");
                  setNegotiatingCandidateId(null);
                }}
                type="button"
              >
                <strong>推薦枠を使う</strong>
                <small>志望度 +24・年1回</small>
              </button>
              <button
                className="scouting-negotiation__commit"
                disabled={
                  !negotiatingReport.recruitment.canCommit ||
                  recruitingCandidateId !== null
                }
                onClick={() => {
                  onRecruit(negotiatingReport.candidateId, "commit");
                  setNegotiatingCandidateId(null);
                }}
                type="button"
              >
                <strong>入学確約</strong>
                <small>
                  {negotiatingReport.recruitment.canCommit
                    ? "この選手の入学を確定する"
                    : "まだ志望度が足りません"}
                </small>
              </button>
            </div>
          </div>
        ) : null}
      </BottomSheet>

      {!loading && excludedReports.length > 0 ? (
        <details className="scouting-excluded-list">
          <summary>対象外 {excludedReports.length}人</summary>
          <div className="scouting-excluded-list__items">
            {excludedReports.map((report) => (
              <article
                className="scouting-excluded-card"
                key={report.candidateId}
              >
                <div>
                  <strong>{report.displayName}</strong>
                  <span>
                    {report.position}・現在能力 {report.estimatedOverall.min}〜
                    {report.estimatedOverall.max}
                  </span>
                </div>
                <button
                  aria-label={`候補に戻す ${report.displayName}`}
                  onClick={() =>
                    setCandidateExcluded(report.candidateId, false)
                  }
                  type="button"
                >
                  候補に戻す
                </button>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </main>
  );
}
