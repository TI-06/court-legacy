import { useMemo, useState } from "react";
import type { GameState } from "../../domain/model/GameState";
import type { SchoolReputation } from "../../domain/model/School";
import {
  FACILITY_DEFINITIONS,
  evaluateFacilityUpgrade,
  type FacilityKey,
} from "../../domain/school/facilityUpgrade";
import { reputationGrade } from "../../domain/school/reputation";
import { rivalryKey } from "../../domain/world/rivalWorldProgression";
import { BottomSheet } from "../../ui/BottomSheet";
import "../../ui/ui.css";
import {
  consumeSchoolViewAfterScouting,
  SchoolNavigationTabs,
  type SchoolView,
} from "./SchoolNavigationTabs";
import "./school-screen.css";

interface SchoolScreenProps {
  state: GameState;
  onUpgradeFacility: (key: FacilityKey) => void;
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
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
  onOpenScouting,
}: SchoolScreenProps) {
  const [view, setView] = useState<SchoolView>(consumeSchoolViewAfterScouting);
  const [selectedFacility, setSelectedFacility] = useState<FacilityKey | null>(
    null,
  );
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

  const destinyRivalId = state.world.destinyRivalSchoolId;
  const destinyRival = destinyRivalId
    ? state.schools[destinyRivalId]
    : undefined;
  const destinyRivalScore = destinyRival
    ? (state.world.rivalryScores[rivalryKey(school.id, destinyRival.id)] ?? 0)
    : 0;
  const graduates = state.history.graduates.filter(
    (graduate) => graduate.schoolId === school.id,
  );
  const selectedDefinition = selectedFacility
    ? FACILITY_DEFINITIONS.find(
        (definition) => definition.key === selectedFacility,
      )
    : null;
  const selectedEvaluation = selectedFacility
    ? evaluateFacilityUpgrade(state, school.id, selectedFacility)
    : null;

  const confirmUpgrade = () => {
    if (!selectedFacility || !selectedEvaluation?.allowed) return;
    onUpgradeFacility(selectedFacility);
    setSelectedFacility(null);
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
        <p className="section-kicker">学校運営</p>
        <div className="school-hero__heading">
          <div>
            <h2>{school.name}</h2>
            <p>
              {reputationLabels[school.reputation]}・評判{" "}
              {reputationGrade(school.reputationPoints)}{" "}
              {school.reputationPoints}
            </p>
          </div>
          <strong>資金 {school.funds}</strong>
        </div>
        <div className="school-summary-grid">
          <span>
            監督<strong>{school.coach.name}</strong>
          </span>
          {destinyRival ? (
            <span>
              宿命校
              <strong>
                {destinyRival.name}・因縁 {destinyRivalScore}
              </strong>
            </span>
          ) : null}
          <span>
            通算シーズン<strong>{school.history.seasons}</strong>
          </span>
        </div>
      </section>

      <SchoolNavigationTabs activeView={view} onSelect={selectView} />

      {view === "facilities" ? (
        <section className="school-panel" aria-labelledby="facility-heading">
          <div className="school-section-heading">
            <div>
              <p className="section-kicker">施設</p>
              <h3 id="facility-heading">設備を強化</h3>
            </div>
            <span>最大 Lv.5</span>
          </div>
          <div className="facility-grid">
            {FACILITY_DEFINITIONS.map((definition) => {
              const evaluation = evaluateFacilityUpgrade(
                state,
                school.id,
                definition.key,
              );
              const missingFunds = Math.max(0, evaluation.cost - school.funds);
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
                  onClick={() => setSelectedFacility(definition.key)}
                  type="button"
                >
                  <span className="facility-tile__top">
                    <strong>{definition.name}</strong>
                    <b>Lv.{evaluation.currentLevel}</b>
                  </span>
                  <small
                    className={
                      evaluation.allowed ? undefined : "facility-tile__warning"
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
              <p className="section-kicker">戦績</p>
              <h3 id="record-heading">学校記録</h3>
            </div>
          </div>
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
                const userSets = home ? match.homeSetsWon : match.awaySetsWon;
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
        </section>
      ) : null}

      {view === "alumni" ? (
        <section className="school-panel" aria-labelledby="alumni-heading">
          <div className="school-section-heading">
            <div>
              <p className="section-kicker">卒業生</p>
              <h3 id="alumni-heading">卒業生記録</h3>
            </div>
          </div>
          {graduates.length === 0 ? (
            <p className="school-empty-state">卒業生の記録はまだありません</p>
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
      ) : null}

      <BottomSheet
        description="資金を使用して設備レベルを1上げます。"
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
              disabled={!selectedEvaluation.allowed}
              onClick={confirmUpgrade}
              type="button"
            >
              {selectedEvaluation.cost}を使って強化
            </button>
          </div>
        ) : null}
      </BottomSheet>
    </main>
  );
}
