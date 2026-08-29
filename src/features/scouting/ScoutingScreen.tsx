import type { GameState } from "../../domain/model/GameState";
import type { PlayerId } from "../../domain/model/identifiers";
import { reputationGrade } from "../../domain/school/reputation";
import type {
  MiddleSchoolAchievement,
  ScoutConfidence,
  ScoutReport,
} from "../../domain/scouting/scoutReport";
import type { ShopItemId } from "../../domain/shop/shopCatalog";
import type {
  ShopStatusResponse,
  ShopUseTarget,
} from "../../domain/shop/shopContracts";
import "./scouting.css";

interface ScoutingScreenProps {
  state: GameState;
  reports: ScoutReport[];
  loading: boolean;
  error: string | null;
  recruitingCandidateId: PlayerId | null;
  shopStatus?: ShopStatusResponse | null;
  shopPendingItemId?: ShopItemId | null;
  shopPendingCandidateId?: string | null;
  onBack: () => void;
  onRetry: () => void;
  onRecruit: (candidateId: PlayerId) => void;
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

function stars(value: ScoutReport["evaluationStars"]): string {
  return `${"★".repeat(value)}${"☆".repeat(5 - value)}`;
}

function currentCycleKey(state: GameState): string {
  return `${state.userSchoolId}:year-${state.yearIndex}`;
}

export function ScoutingScreen({
  state,
  reports,
  loading,
  error,
  recruitingCandidateId,
  shopStatus = null,
  shopPendingItemId = null,
  shopPendingCandidateId = null,
  onBack,
  onRetry,
  onRecruit,
  onUseShopItem = () => undefined,
}: ScoutingScreenProps) {
  const school = state.schools[state.userSchoolId]!;
  const committedCandidateIds =
    state.recruiting?.cycleKey === currentCycleKey(state)
      ? state.recruiting.committedCandidateIds
      : [];
  const committed = new Set<PlayerId>(committedCandidateIds);
  const researchStatus = shopStatus?.items.find(
    (item) => item.itemId === "scout-research",
  );
  const appraisalStatus = shopStatus?.items.find(
    (item) => item.itemId === "potential-appraisal",
  );

  return (
    <main className="scouting-screen app-content">
      <section className="scouting-hero">
        <button
          className="scouting-back"
          onClick={onBack}
          type="button"
          aria-label="育成へ戻る"
        >
          ← 育成へ戻る
        </button>
        <div className="scouting-hero__heading">
          <div>
            <span className="section-kicker">RECRUITING</span>
            <h1>新入生スカウト</h1>
            <p>見えている情報だけを材料に、来年度の戦力候補を見極めます。</p>
          </div>
          <strong className="scouting-grade">
            評判 {reputationGrade(school.reputationPoints)}
          </strong>
        </div>
        <div className="scouting-summary" aria-label="スカウト状況">
          <div>
            <span>スカウト網</span>
            <strong>Lv.{school.facilities.scoutingNetwork}</strong>
          </div>
          <div>
            <span>監督観察力</span>
            <strong>{school.coach.observation}</strong>
          </div>
          <div>
            <span>獲得人数</span>
            <strong>{committedCandidateIds.length}人</strong>
          </div>
        </div>
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

      {!loading && reports.length > 0 ? (
        <section className="scouting-list" aria-label="スカウト候補一覧">
          {reports.map((report) => {
            const isCommitted = committed.has(report.candidateId);
            const isRecruiting = recruitingCandidateId === report.candidateId;
            const buttonLabel = isCommitted
              ? "獲得済み"
              : isRecruiting
                ? "入学交渉中…"
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

            return (
              <article className="scouting-card" key={report.candidateId}>
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
                </div>

                <div className="scouting-estimates">
                  <div>
                    <strong>
                      現在能力 {report.estimatedOverall.min}〜
                      {report.estimatedOverall.max}
                    </strong>
                  </div>
                  <div>
                    <strong>
                      将来性 {report.estimatedPotential.min}〜
                      {report.estimatedPotential.max}
                    </strong>
                  </div>
                </div>

                <ul className="scouting-comments">
                  {report.comments.map((comment) => (
                    <li key={comment}>{comment}</li>
                  ))}
                </ul>

                {researchAvailable || appraisalAvailable ? (
                  <div className="scouting-shop-actions">
                    {researchAvailable ? (
                      <button
                        aria-label={`スカウト再調査 ${report.displayName}`}
                        disabled={shopPendingItemId !== null}
                        onClick={() =>
                          onUseShopItem("scout-research", {
                            type: "scouting-candidate",
                            candidateId: report.candidateId,
                          })
                        }
                        type="button"
                      >
                        {researchPending ? "効果を反映中…" : "スカウト再調査"}
                      </button>
                    ) : null}
                    {appraisalAvailable ? (
                      <button
                        aria-label={`潜在能力鑑定 ${report.displayName}`}
                        disabled={shopPendingItemId !== null}
                        onClick={() =>
                          onUseShopItem("potential-appraisal", {
                            type: "scouting-candidate",
                            candidateId: report.candidateId,
                          })
                        }
                        type="button"
                      >
                        {appraisalPending ? "効果を反映中…" : "潜在能力鑑定"}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <button
                  aria-label={`${buttonLabel} ${report.displayName}`}
                  className="scouting-recruit"
                  disabled={
                    isCommitted ||
                    isRecruiting ||
                    recruitingCandidateId !== null
                  }
                  onClick={() => onRecruit(report.candidateId)}
                  type="button"
                >
                  {buttonLabel}
                </button>
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}