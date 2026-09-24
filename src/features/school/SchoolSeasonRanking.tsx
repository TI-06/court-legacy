import { useState } from "react";
import type {
  SeasonProgressPresentation,
  SeasonRankingPresentation,
} from "../season/seasonProgressPresentation";
import { BottomSheet } from "../../ui/BottomSheet";
import "./school-season-ranking.css";

function rankMovementLabel(
  movement: number,
  baselineComparable: boolean,
): string {
  if (!baselineComparable) return "基準更新";
  if (movement > 0) return `▲${movement}`;
  if (movement < 0) return `▼${Math.abs(movement)}`;
  return "→0";
}

function RankingScope({
  label,
  ranking,
  onOpen,
}: {
  label: "県内" | "全国";
  ranking: SeasonRankingPresentation;
  onOpen: () => void;
}) {
  return (
    <section
      aria-label={`${label}ランキング`}
      className="school-season-ranking__scope"
    >
      <div className="school-season-ranking__scope-heading">
        <div>
          <span>{label}ランキング</span>
          <strong>
            {ranking.rank}位 / {ranking.total}校
          </strong>
        </div>
        <b
          className={
            ranking.baselineComparable && ranking.movement < 0
              ? "is-down"
              : undefined
          }
        >
          {rankMovementLabel(ranking.movement, ranking.baselineComparable)}
        </b>
      </div>
      <small>
        {ranking.baselineComparable
          ? `開始時 ${ranking.startingRank}位`
          : `順位母集団 ${ranking.startingTotal}校 → ${ranking.total}校`}
      </small>
      <button
        aria-label={`${label}周辺校を見る`}
        className="school-season-ranking__scope-action"
        onClick={onOpen}
        type="button"
      >
        <span>周辺校</span>
        <b aria-hidden="true">›</b>
      </button>
    </section>
  );
}

function NearbyRankingRows({
  label,
  ranking,
}: {
  label: "県内" | "全国";
  ranking: SeasonRankingPresentation;
}) {
  return (
    <div
      className="school-season-ranking__nearby school-season-ranking__nearby--sheet"
      aria-label={`${label}周辺校`}
    >
      {ranking.nearby.map((row) => (
        <div
          className={`school-season-ranking__row${row.isUserSchool ? " is-user" : ""}`}
          data-testid={
            row.isUserSchool ? "school-ranking-user-row" : "school-ranking-row"
          }
          key={row.schoolId}
        >
          <b>{row.rank}</b>
          <span title={row.displayName}>
            {row.shortName}
            {label === "全国" && row.regionLabel ? ` · ${row.regionLabel}` : ""}
          </span>
          <small>評判 {row.reputationPoints}</small>
        </div>
      ))}
    </div>
  );
}

export function SchoolSeasonRanking({
  presentation,
}: {
  presentation: SeasonProgressPresentation;
}) {
  const [selectedScope, setSelectedScope] = useState<
    "regional" | "national" | null
  >(null);
  const selectedLabel = selectedScope === "regional" ? "県内" : "全国";
  const selectedRanking =
    selectedScope === "regional"
      ? presentation.regional
      : selectedScope === "national"
        ? presentation.national
        : null;

  return (
    <>
      <section className="school-season-ranking" aria-label="今季ランキング">
        <div className="school-season-ranking__heading">
          <div>
            <span>SEASON</span>
            <h4>今季ランキング</h4>
          </div>
          <div className="school-season-ranking__status">
            <b>{presentation.ambitionLabel}</b>
            <strong>
              {presentation.achievedCount}/{presentation.goalCount} 目標達成
            </strong>
            <small>残り報酬 +{presentation.remainingRewardFunds}</small>
          </div>
        </div>

        <div className="school-season-ranking__goals">
          {presentation.goals.map((goal) => (
            <article
              className={goal.achieved ? "is-achieved" : undefined}
              data-testid="school-season-goal"
              key={goal.id}
            >
              <div>
                <strong>{goal.label}</strong>
                <small>
                  {goal.progressLabel}・{goal.remainingLabel}・年度末 +
                  {goal.rewardFunds}
                </small>
              </div>
              <b aria-label={goal.achieved ? "達成済み" : "挑戦中"}>
                {goal.achieved ? "✓" : "進行中"}
              </b>
            </article>
          ))}
        </div>

        <div className="school-season-ranking__scopes">
          <RankingScope
            label="県内"
            onOpen={() => setSelectedScope("regional")}
            ranking={presentation.regional}
          />
          <RankingScope
            label="全国"
            onOpen={() => setSelectedScope("national")}
            ranking={presentation.national}
          />
        </div>
      </section>

      <BottomSheet
        className="ui-bottom-sheet--game-choice"
        description={
          selectedRanking
            ? `現在 ${selectedRanking.rank}位 / ${selectedRanking.total}校。自校周辺の順位を表示します。`
            : undefined
        }
        onClose={() => setSelectedScope(null)}
        open={Boolean(selectedRanking)}
        title={`${selectedLabel}ランキング`}
      >
        {selectedRanking ? (
          <NearbyRankingRows label={selectedLabel} ranking={selectedRanking} />
        ) : null}
      </BottomSheet>
    </>
  );
}
